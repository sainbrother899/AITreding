// 1. Supabase Initialization with Your Exact Project Credentials
const SUPABASE_URL = "https://gijafjwjrmymtonddvfv.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_vVZFBYp-tXwKmwCCmIrgdw_-ZVQ1aFG";

// Correct instantiation method for version 2.x
const supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// System State Variables
let currentMode = 'DEMO';
let demoBalance = 10000.00;
let realBalance = 0.00;
let tradesUsed = 0;

// 2. Initialize TradingView Live Chart
let chartWidget = new TradingView.widget({
    "width": "100%",
    "height": "100%",
    "symbol": "BINANCE:BTCUSDT",
    "interval": "5",
    "timezone": "Asia/Kolkata",
    "theme": "dark",
    "style": "1",
    "locale": "en",
    "enable_publishing": false,
    "hide_side_toolbar": false,
    "container_id": "crypto_live_chart"
});

// 3. Sync Signals from Database (Real-time Integration)
async function listenToSignals() {
    // Initial fetch for current signal state
    let { data: market_signals, error } = await supabase
        .from('market_signals')
        .select('*')
        .eq('coin_name', 'BINANCE:BTCUSDT')
        .maybeSingle();
    
    if(market_signals) {
        updateSignalUI(market_signals.current_signal);
    } else if (error) {
        console.error("Signal fetch error:", error.message);
    }

    // Real-time listener: triggers instantly when admin changes value in Supabase dashboard
    supabase
        .channel('schema-db-changes')
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'market_signals' }, payload => {
            if(payload.new && payload.new.coin_name === 'BINANCE:BTCUSDT') {
                updateSignalUI(payload.new.current_signal);
            }
        })
        .subscribe();
}

// Update UI based on current signal state
function updateSignalUI(signal) {
    const box = document.getElementById('signalBox');
    const txt = document.getElementById('aiSignalText');
    
    txt.innerText = `${signal} BTC NOW`;
    
    if(signal === 'BUY') {
        box.className = "bg-emerald-950/40 border border-emerald-500/30 p-5 rounded-xl text-center mb-6 transition-all duration-300";
        txt.className = "text-2xl font-black text-emerald-400 animate-pulse";
    } else {
        box.className = "bg-rose-950/40 border border-rose-500/30 p-5 rounded-xl text-center mb-6 transition-all duration-300";
        txt.className = "text-2xl font-black text-rose-400 animate-pulse";
    }
}

// 4. Toggle System between Demo Account & Real Account
function switchMode(mode) {
    currentMode = mode;
    const demoBtn = document.getElementById('demoBtn');
    const realBtn = document.getElementById('realBtn');
    const balanceText = document.getElementById('walletBalance');

    if(mode === 'DEMO') {
        demoBtn.className = "px-4 py-1.5 rounded-md text-sm font-medium bg-[#0ecb81] text-white transition-all cursor-pointer";
        realBtn.className = "px-4 py-1.5 rounded-md text-sm font-medium text-gray-400 transition-all cursor-pointer";
        balanceText.innerText = `$${demoBalance.toFixed(2)}`;
        balanceText.className = "text-lg font-bold text-[#0ecb81]";
    } else {
        realBtn.className = "px-4 py-1.5 rounded-md text-sm font-medium bg-[#0ecb81] text-white transition-all cursor-pointer";
        demoBtn.className = "px-4 py-1.5 rounded-md text-sm font-medium text-gray-400 transition-all cursor-pointer";
        balanceText.innerText = `$${realBalance.toFixed(2)}`;
        balanceText.className = "text-lg font-bold text-amber-500";
    }
}

// 5. Handle Percentage Auto-Calculation Shortcuts
function setAmountPct(pct) {
    let baseBalance = (currentMode === 'DEMO') ? demoBalance : realBalance;
    let targetAmount = (baseBalance * pct) / 100;
    document.getElementById('tradeAmountInput').value = Math.floor(targetAmount);
}

// 6. Execute Trade Logic and Push Entry data to Supabase 
async function executeTrade() {
    if(tradesUsed >= 10) {
        alert("Aapki aaj ki 10 trades ki limit poori ho gayi hai!");
        return;
    }

    let amt = parseFloat(document.getElementById('tradeAmountInput').value);
    let baseBalance = (currentMode === 'DEMO') ? demoBalance : realBalance;

    if(amt > baseBalance || amt <= 0 || isNaN(amt)) {
        alert("Insufficient balance ya invalid amount!");
        return;
    }

    // Process Balance Deductions
    if(currentMode === 'DEMO') {
        demoBalance -= amt;
    } else {
        realBalance -= amt;
    }
    tradesUsed++;

    let fullSignalText = document.getElementById('aiSignalText').innerText;
    let signalType = fullSignalText.startsWith('BUY') ? 'BUY' : 'SELL';

    // Insert trade payload record into Supabase Database 
    const { data, error } = await supabase
        .from('trades')
        .insert([
            { 
                coin_name: 'BTCUSDT', 
                trade_type: signalType, 
                account_type: currentMode, 
                entry_price: 64250.00, // Fixed placeholder price for entry representation
                trade_amount: amt,
                status: 'RUNNING'
            }
        ])
        .select();

    if(error) {
        alert("Database transaction failed: " + error.message);
    } else {
        // Sync UI views
        switchMode(currentMode);
        document.getElementById('tradeCounter').innerText = `${tradesUsed}/10`;
        loadActiveTrades();
    }
}

// 7. Pull Current Active Trades from Supabase and render into standard interface tables
async function loadActiveTrades() {
    let { data: trades, error } = await supabase
        .from('trades')
        .select('*')
        .order('id', { ascending: false });
        
    let table = document.getElementById('activeTradesLog');
    
    if(trades && trades.length > 0) {
        table.innerHTML = ''; // Wipe clean default rows
        trades.forEach(t => {
            let color = t.trade_type === 'BUY' ? 'text-emerald-400' : 'text-rose-400';
            let formattedPrice = parseFloat(t.entry_price).toFixed(2);
            let formattedAmt = parseFloat(t.trade_amount).toFixed(2);
            
            table.innerHTML += `<tr class="border-b border-[#2a2e39] text-gray-200 text-sm hover:bg-[#222634] transition-all">
                <td class="py-3 pl-2 font-bold">${t.coin_name}</td>
                <td class="${color} font-bold">${t.trade_type}</td>
                <td>$${formattedAmt}</td>
                <td>$${formattedPrice}</td>
                <td class="text-emerald-400 font-bold">+$0.00</td>
                <td><span class="bg-[#2a2e39] px-2 py-0.5 rounded text-xs text-gray-300 font-medium">${t.status}</span></td>
            </tr>`;
        });
    }
}

// Global Lifecycle trigger setup
window.onload = function() {
    listenToSignals();
    loadActiveTrades();
};
