#!/usr/bin/env python3

import asyncio
import json
import time
import logging
from datetime import datetime, timezone
from typing import Dict, List, Optional
import requests
import websockets
from flask import Flask, jsonify, request, send_from_directory, send_file
from flask_cors import CORS
import threading
import subprocess
import os
import random
from functools import wraps

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app)

# Global state
current_opportunities = []
price_history = {}
jupiter_quotes = {}
agent_process = None
websocket_connections = set()

# Jupiter API endpoints
JUPITER_QUOTE_API = "https://quote-api.jup.ag/v6/quote"
JUPITER_PRICE_API = "https://price.jup.ag/v4/price"

# CoinGecko API endpoints
COINGECKO_API = "https://api.coingecko.com/api/v3/simple/price"
COINGECKO_TOKEN_LIST = "https://api.coingecko.com/api/v3/coins/list"

# Token mapping for CoinGecko (backup pricing source)
COINGECKO_TOKEN_MAP = {
    'SOL': 'solana',
    'USDC': 'usd-coin', 
    'RAY': 'raydium',
    'ORCA': 'orca',
    'BONK': 'bonk',
    'JUP': 'jupiter-exchange-solana'
}

# Trading pairs and their mint addresses
TRADING_PAIRS = {
    'SOL/USDC': {
        'input_mint': 'So11111111111111111111111111111111111111112',  # SOL
        'output_mint': 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'  # USDC
    },
    'RAY/USDC': {
        'input_mint': '4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R',  # RAY
        'output_mint': 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'  # USDC
    },
    'ORCA/USDC': {
        'input_mint': 'orcaEKTdK7LKz57vaAYr9QeNsVEPfiu6QeMU1kektZE',  # ORCA
        'output_mint': 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'  # USDC
    },
    'BONK/USDC': {
        'input_mint': 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263',  # BONK
        'output_mint': 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'  # USDC
    },
    'JUP/USDC': {
        'input_mint': 'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN',   # JUP
        'output_mint': 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'  # USDC
    }
}

# DEX Program IDs for route identification
DEX_PROGRAM_IDS = {
    'Raydium': ['675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8'],
    'Orca': ['whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc'],
    'Lifinity': ['EewxydAPCCVuNEyrVN68PuSYdQ7wKn27V9Gjeoi8dy3S']
}

# Rate limiting and retry logic
api_call_times = {'jupiter': [], 'coingecko': []}
MAX_CALLS_PER_MINUTE = {'jupiter': 10, 'coingecko': 15}  # Conservative limits

def rate_limit_check(api_name: str) -> bool:
    """Check if we can make an API call without hitting rate limits"""
    current_time = time.time()
    # Remove calls older than 1 minute
    api_call_times[api_name] = [t for t in api_call_times[api_name] if current_time - t < 60]
    
    # Check if we can make another call
    if len(api_call_times[api_name]) >= MAX_CALLS_PER_MINUTE[api_name]:
        return False
    
    # Record this call
    api_call_times[api_name].append(current_time)
    return True

async def get_jupiter_quote_with_retry(input_mint: str, output_mint: str, amount: int = 1000000, max_retries: int = 2) -> Optional[Dict]:
    """Get quote from Jupiter API with retry logic and rate limiting"""
    for attempt in range(max_retries + 1):
        try:
            # Check rate limit
            if not rate_limit_check('jupiter'):
                logger.info("Jupiter rate limit reached, skipping call")
                return None
                
            params = {
                'inputMint': input_mint,
                'outputMint': output_mint,
                'amount': amount,
                'slippageBps': 50  # 0.5% slippage
            }
            
            response = requests.get(JUPITER_QUOTE_API, params=params, timeout=10)
            if response.status_code == 200:
                return response.json()
            elif response.status_code == 429:
                # Rate limited, wait with exponential backoff
                wait_time = (2 ** attempt) + random.uniform(0, 1)
                logger.info(f"Jupiter rate limited, waiting {wait_time:.1f}s before retry {attempt + 1}/{max_retries}")
                if attempt < max_retries:
                    await asyncio.sleep(wait_time)
                    continue
                else:
                    logger.error("Jupiter API rate limit exceeded, max retries reached")
                    return None
            else:
                logger.error(f"Jupiter API error: {response.status_code}")
                return None
        except Exception as e:
            logger.error(f"Error fetching Jupiter quote (attempt {attempt + 1}): {e}")
            if attempt < max_retries:
                wait_time = (2 ** attempt) + random.uniform(0, 1)
                await asyncio.sleep(wait_time)
            else:
                return None
    return None

# Keep the old function name for compatibility
async def get_jupiter_quote(input_mint: str, output_mint: str, amount: int = 1000000) -> Optional[Dict]:
    return await get_jupiter_quote_with_retry(input_mint, output_mint, amount)

async def get_coingecko_prices_with_retry(token_ids: List[str], max_retries: int = 2) -> Optional[Dict]:
    """Get prices from CoinGecko API with retry logic and rate limiting"""
    for attempt in range(max_retries + 1):
        try:
            # Check rate limit
            if not rate_limit_check('coingecko'):
                logger.info("CoinGecko rate limit reached, skipping call")
                return None
                
            params = {
                'ids': ','.join(token_ids),
                'vs_currencies': 'usd',
                'include_24hr_change': 'true'
            }
            
            response = requests.get(COINGECKO_API, params=params, timeout=10)
            if response.status_code == 200:
                return response.json()
            elif response.status_code == 429:
                # Rate limited, wait with exponential backoff
                wait_time = (2 ** attempt) + random.uniform(0, 1)
                logger.info(f"CoinGecko rate limited, waiting {wait_time:.1f}s before retry {attempt + 1}/{max_retries}")
                if attempt < max_retries:
                    await asyncio.sleep(wait_time)
                    continue
                else:
                    logger.error("CoinGecko API rate limit exceeded, max retries reached")
                    return None
            else:
                logger.error(f"CoinGecko API error: {response.status_code}")
                return None
        except Exception as e:
            logger.error(f"Error fetching CoinGecko prices (attempt {attempt + 1}): {e}")
            if attempt < max_retries:
                wait_time = (2 ** attempt) + random.uniform(0, 1)
                await asyncio.sleep(wait_time)
            else:
                return None
    return None

# Keep the old function name for compatibility
async def get_coingecko_prices(token_ids: List[str]) -> Optional[Dict]:
    return await get_coingecko_prices_with_retry(token_ids)

def create_quote_from_coingecko(pair: str, prices: Dict, base_dex: str = "Raydium") -> Optional[Dict]:
    """Create a quote structure from CoinGecko price data"""
    try:
        tokens = pair.split('/')
        base_token = tokens[0]
        quote_token = tokens[1]
        
        # Get CoinGecko IDs
        base_id = COINGECKO_TOKEN_MAP.get(base_token)
        quote_id = COINGECKO_TOKEN_MAP.get(quote_token)
        
        if not base_id or not quote_id:
            return None
            
        base_price = prices.get(base_id, {}).get('usd', 0)
        quote_price = prices.get(quote_id, {}).get('usd', 1)
        
        if base_price <= 0 or quote_price <= 0:
            return None
            
        # Calculate price ratio (how much quote token for 1 base token)
        price_ratio = base_price / quote_price
        
        # Simulate quote structure similar to Jupiter
        quote = {
            'dex': base_dex,
            'price': price_ratio,
            'liquidity': 300000 + (hash(base_dex + pair) % 500000),  # Simulated liquidity
            'slippage': 0.003 + (hash(base_dex) % 20) / 10000,  # 0.3-0.5%
            'directRoute': [base_token, base_dex, quote_token],
            'multiHopRoute': [base_token, quote_token],
            'fees': 0.0025,  # 0.25% typical DEX fee
            'source': 'coingecko'  # Mark as backup source
        }
        
        return quote
        
    except Exception as e:
        logger.error(f"Error creating CoinGecko quote: {e}")
        return None

def identify_dex_from_route(route_plan: List[Dict]) -> str:
    """Identify DEX from Jupiter route plan"""
    if not route_plan:
        return "Unknown"
    
    # Check the AMM key or program ID in the route
    for step in route_plan:
        if 'swapInfo' in step:
            amm_key = step['swapInfo'].get('ammKey', '')
            program_id = step['swapInfo'].get('programId', '')
            
            # Simple heuristic based on program IDs
            for dex_name, program_ids in DEX_PROGRAM_IDS.items():
                if any(pid in program_id for pid in program_ids):
                    return dex_name
    
    # Fallback based on route plan structure
    if len(route_plan) == 1:
        return "Raydium"  # Often direct routes
    elif len(route_plan) > 1:
        return "Orca"     # Often multi-hop
    
    return "Lifinity"

async def fetch_all_dex_quotes(pair: str) -> List[Dict]:
    """Fetch quotes from multiple DEXs for arbitrage comparison"""
    if pair not in TRADING_PAIRS:
        return []
    
    pair_info = TRADING_PAIRS[pair]
    quotes = []
    jupiter_success = False
    
    # Try Jupiter first (primary source)
    jupiter_quote = await get_jupiter_quote(
        pair_info['input_mint'], 
        pair_info['output_mint']
    )
    
    if jupiter_quote:
        route_plan = jupiter_quote.get('routePlan', [])
        dex = identify_dex_from_route(route_plan)
        
        in_amount = int(jupiter_quote.get('inAmount', 1000000))
        out_amount = int(jupiter_quote.get('outAmount', 0))
        
        if in_amount > 0 and out_amount > 0:
            price = out_amount / in_amount
            
            quote = {
                'dex': dex,
                'price': price,
                'liquidity': 500000 + (hash(str(jupiter_quote)) % 1000000),  # Simulated
                'slippage': float(jupiter_quote.get('slippageBps', 50)) / 10000,
                'directRoute': [pair.split('/')[0], dex, pair.split('/')[1]],
                'multiHopRoute': [step.get('swapInfo', {}).get('inputMint', '') for step in route_plan],
                'fees': sum([float(step.get('feeAmount', 0)) / in_amount for step in route_plan if 'feeAmount' in step]),
                'source': 'jupiter'
            }
            quotes.append(quote)
            jupiter_success = True
    
    # If Jupiter fails, try CoinGecko as backup
    if not jupiter_success:
        logger.info(f"Jupiter failed for {pair}, trying CoinGecko backup...")
        tokens = pair.split('/')
        token_ids = [COINGECKO_TOKEN_MAP[token] for token in tokens if token in COINGECKO_TOKEN_MAP]
        
        if len(token_ids) == 2:
            coingecko_prices = await get_coingecko_prices(token_ids)
            if coingecko_prices:
                # Create quotes for each DEX using CoinGecko prices
                for dex in ['Raydium', 'Orca', 'Lifinity']:
                    cg_quote = create_quote_from_coingecko(pair, coingecko_prices, dex)
                    if cg_quote:
                        # Add some variance between DEXs to simulate real market conditions
                        variance = (hash(dex + pair + str(int(time.time()))) % 100 - 50) / 10000
                        cg_quote['price'] *= (1 + variance)
                        quotes.append(cg_quote)
                
                logger.info(f"Using CoinGecko backup for {pair}, created {len(quotes)} quotes")
                return quotes
    
    # Generate additional simulated quotes for other DEXs (only if Jupiter succeeded)
    if jupiter_success and quotes:
        base_price = quotes[0]['price']
        remaining_dexes = [dex for dex in ['Raydium', 'Orca', 'Lifinity'] 
                          if dex != quotes[0]['dex']]
        
        for dex in remaining_dexes:
            variance = (hash(dex + pair + str(int(time.time()))) % 100 - 50) / 10000  # ±0.5%
            simulated_quote = {
                'dex': dex,
                'price': base_price * (1 + variance),
                'liquidity': 100000 + (hash(dex + pair) % 800000),
                'slippage': (hash(dex) % 50 + 10) / 10000,  # 0.1-0.6%
                'directRoute': [pair.split('/')[0], dex, pair.split('/')[1]],
                'multiHopRoute': [pair.split('/')[0], 'WSOL', pair.split('/')[1]],
                'fees': (hash(dex + 'fees') % 75 + 25) / 10000,  # 0.25-1%
                'source': 'jupiter_simulated'
            }
            quotes.append(simulated_quote)
    
    return quotes

def generate_arbitrage_opportunities():
    """Generate arbitrage opportunities from current quotes"""
    global current_opportunities, price_history
    
    opportunities = []
    
    for pair in TRADING_PAIRS.keys():
        # Use cached quotes or fetch new ones
        quotes_key = f"quotes_{pair}"
        if quotes_key not in jupiter_quotes or time.time() - jupiter_quotes[quotes_key]['timestamp'] > 5:
            # Quotes are stale, will be refreshed in background
            continue
        
        quotes = jupiter_quotes[quotes_key]['data']
        
        # Find arbitrage opportunities between DEXs
        for i, buy_quote in enumerate(quotes):
            for j, sell_quote in enumerate(quotes):
                if i != j:
                    spread = ((sell_quote['price'] - buy_quote['price']) / buy_quote['price']) * 100
                    
                    if spread > 0.1:  # Minimum 0.1% spread
                        estimated_profit = spread - (buy_quote['slippage'] * 100) - (sell_quote['slippage'] * 100)
                        estimated_gas = 0.01 + (hash(f"{buy_quote['dex']}{sell_quote['dex']}") % 20) / 1000
                        net_profit = estimated_profit - estimated_gas
                        
                        if net_profit > 0:
                            confidence = min(
                                (buy_quote['liquidity'] + sell_quote['liquidity']) / 20000 * 40 +
                                min(spread / 2, 1) * 30 +
                                (100 - abs(hash(pair) % 30)) / 100 * 30,
                                100
                            )
                            
                            # Determine data source for this opportunity
                            data_source = 'mixed'
                            if hasattr(buy_quote, 'get') and hasattr(sell_quote, 'get'):
                                buy_source = buy_quote.get('source', 'unknown')
                                sell_source = sell_quote.get('source', 'unknown')
                                if buy_source == sell_source:
                                    data_source = buy_source
                                else:
                                    data_source = f"{buy_source}/{sell_source}"
                            
                            opportunity = {
                                'id': f"{pair.replace('/', '-')}-{buy_quote['dex']}-{sell_quote['dex']}-{int(time.time() * 1000)}",
                                'pair': pair,
                                'buyDex': buy_quote['dex'],
                                'sellDex': sell_quote['dex'],
                                'buyPrice': buy_quote['price'],
                                'sellPrice': sell_quote['price'],
                                'spread': spread,
                                'estimatedProfit': estimated_profit,
                                'estimatedGas': estimated_gas,
                                'netProfit': net_profit,
                                'confidence': confidence,
                                'timestamp': int(time.time() * 1000),
                                'route': [f"Buy on {buy_quote['dex']}", f"Sell on {sell_quote['dex']}"],
                                'dataSource': data_source,
                                'buyLiquidity': buy_quote.get('liquidity', 0),
                                'sellLiquidity': sell_quote.get('liquidity', 0)
                            }
                            opportunities.append(opportunity)
    
    # Sort by net profit and keep top 10
    opportunities.sort(key=lambda x: x['netProfit'], reverse=True)
    current_opportunities = opportunities[:10]
    
    # Update price history
    for opp in current_opportunities:
        if opp['pair'] not in price_history:
            price_history[opp['pair']] = []
        price_history[opp['pair']].append(opp['spread'])
        if len(price_history[opp['pair']]) > 50:
            price_history[opp['pair']] = price_history[opp['pair']][-50:]

async def background_quote_fetcher():
    """Background task to fetch quotes from Jupiter"""
    global jupiter_quotes
    
    while True:
        try:
            for pair in TRADING_PAIRS.keys():
                quotes = await fetch_all_dex_quotes(pair)
                jupiter_quotes[f"quotes_{pair}"] = {
                    'data': quotes,
                    'timestamp': time.time()
                }
            
            # Generate arbitrage opportunities
            generate_arbitrage_opportunities()
            
            logger.info(f"Updated quotes for all pairs. Found {len(current_opportunities)} opportunities.")
            
        except Exception as e:
            logger.error(f"Error in background quote fetcher: {e}")
        
        # Longer interval to reduce API load and avoid rate limiting
        await asyncio.sleep(10)  # Fetch every 10 seconds instead of 3

def start_background_tasks():
    """Start background tasks for quote fetching"""
    def run_async_loop():
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        loop.run_until_complete(background_quote_fetcher())
    
    thread = threading.Thread(target=run_async_loop, daemon=True)
    thread.start()
    logger.info("Started background quote fetching")

# API Routes
@app.route('/api/quotes')
def get_quotes():
    pair = request.args.get('pair', 'SOL/USDC')
    
    quotes_key = f"quotes_{pair}"
    if quotes_key in jupiter_quotes:
        quotes_data = jupiter_quotes[quotes_key]['data']
        return jsonify({
            'pair': pair,
            'timestamp': int(time.time() * 1000),
            'quotes': quotes_data
        })
    
    # Return empty response if no data
    return jsonify({
        'pair': pair,
        'timestamp': int(time.time() * 1000),
        'quotes': []
    })

@app.route('/api/arbitrage/opportunities')
def get_arbitrage_opportunities():
    min_pnl = float(request.args.get('minPnl', 0))
    max_latency = int(request.args.get('maxLatency', 1000))
    pair_filter = request.args.get('pair')
    
    filtered_opportunities = [
        opp for opp in current_opportunities
        if opp['netProfit'] >= min_pnl and 
           (not pair_filter or pair_filter == 'All' or opp['pair'] == pair_filter)
    ]
    
    return jsonify({
        'opportunities': filtered_opportunities,
        'totalCount': len(filtered_opportunities),
        'timestamp': int(time.time() * 1000)
    })

@app.route('/api/simulate/trade', methods=['POST'])
def simulate_trade():
    data = request.get_json()
    opportunity_id = data.get('opportunityId')
    amount = data.get('amount', 1000)
    
    # Find the opportunity
    opportunity = next((opp for opp in current_opportunities if opp['id'] == opportunity_id), None)
    if not opportunity:
        return jsonify({'error': 'Opportunity not found'}), 404
    
    # Simulate execution
    execution_latency = 100 + (hash(opportunity_id) % 500)  # 100-600ms
    slippage_impact = 0.1 + (hash(opportunity_id + str(amount)) % 50) / 100  # 0.1-0.6%
    actual_profit = opportunity['netProfit'] * (amount / 1000) * (1 - slippage_impact / 100)
    
    # Simulate delay
    time.sleep(execution_latency / 1000)
    
    return jsonify({
        'success': True,
        'executionTime': execution_latency,
        'originalEstimate': opportunity['netProfit'],
        'actualProfit': actual_profit,
        'slippageImpact': slippage_impact,
        'gasUsed': opportunity['estimatedGas'],
        'route': opportunity['route'],
        'timestamp': int(time.time() * 1000)
    })

@app.route('/api/price-history')
def get_price_history_all():
    pair = request.args.get('pair', 'SOL/USDC')
    
    return jsonify({
        'pair': pair,
        'history': price_history.get(pair, []),
        'timestamp': int(time.time() * 1000)
    })

@app.route('/api/price-history/<pair>')
def get_price_history(pair):
    # Convert pair format (e.g., SOL-USDC to SOL/USDC)
    formatted_pair = pair.replace('-', '/')
    
    # Get price history for this pair
    history = price_history.get(formatted_pair, [])
    
    # Generate some synthetic historical data if we don't have enough
    if len(history) < 20:
        # Create 20 data points with realistic price movement
        base_price = history[-1] if history else 1.0
        synthetic_history = []
        
        for i in range(20 - len(history)):
            # Add some random walk movement
            variation = (hash(f"{formatted_pair}{i}") % 200 - 100) / 10000  # ±1%
            new_price = base_price * (1 + variation)
            synthetic_history.append(new_price)
            base_price = new_price
        
        history = synthetic_history + history
    
    return jsonify({
        'pair': formatted_pair,
        'history': history[-20:],  # Last 20 data points
        'timestamp': int(time.time() * 1000)
    })

@app.route('/health')
def health_check():
    # Check data source status
    jupiter_working = True
    coingecko_working = True
    
    # Quick test of Jupiter API
    try:
        test_response = requests.get(JUPITER_QUOTE_API, params={'inputMint': 'So11111111111111111111111111111111111111112', 'outputMint': 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', 'amount': 1000000}, timeout=5)
        jupiter_working = test_response.status_code == 200
    except:
        jupiter_working = False
    
    # Quick test of CoinGecko API
    try:
        test_response = requests.get(COINGECKO_API, params={'ids': 'solana', 'vs_currencies': 'usd'}, timeout=5)
        coingecko_working = test_response.status_code == 200
    except:
        coingecko_working = False
    
    return jsonify({
        'status': 'healthy',
        'timestamp': int(time.time() * 1000),
        'opportunities_count': len(current_opportunities),
        'pairs_tracking': len(jupiter_quotes),
        'data_sources': {
            'jupiter': {
                'status': 'active' if jupiter_working else 'error',
                'primary': True
            },
            'coingecko': {
                'status': 'active' if coingecko_working else 'error', 
                'backup': True
            }
        }
    })

# Serve React frontend - try built version first, fallback to dev
@app.route('/')
def serve_frontend():
    try:
        return send_file('dist/index.html')
    except:
        return send_file('public/index.html')

@app.route('/assets/<path:filename>')
def serve_assets(filename):
    return send_from_directory('dist/assets', filename)

@app.route('/src/<path:filename>')
def serve_src(filename):
    # Set proper MIME type for TypeScript files
    if filename.endswith('.tsx') or filename.endswith('.ts'):
        from flask import Response
        with open(f'src/{filename}', 'r') as f:
            content = f.read()
        return Response(content, mimetype='application/javascript')
    return send_from_directory('src', filename)

@app.route('/public/<path:filename>')
def serve_public(filename):
    return send_from_directory('public', filename)

# Catch-all route for React Router
@app.route('/<path:path>')
def serve_react_routes(path):
    # For React Router, serve index.html for any unmatched routes
    if not path.startswith('api/'):
        try:
            return send_file('dist/index.html')
        except:
            return send_file('public/index.html')
    return {'error': 'API endpoint not found'}, 404

if __name__ == '__main__':
    # Start background tasks
    start_background_tasks()
    
    # Start Flask server
    app.run(host='0.0.0.0', port=5000, debug=False, threaded=True)