let currentMode = 'DEMO';
let demoBalance = 10000.00;
let realBalance = 0.00;
let tradesUsed = 0;

new TradingView.widget({
    "width": "100%",
    "height": "100%",
    "symbol": "BINANCE:BTCUSDT",
    "interval": "5",
    "theme": "dark",
    "container_id": "crypto_live_chart"
});

function switchMode(mode) {
    currentMode = mode;
    document.getElementById('walletBalance').innerText = mode === 'DEMO' ? `$${demoBalance}` : `$${realBalance}`;
}

function executeTrade() {
    alert("Website Interface Ready! Ab step 2 me Supabase connect karenge.");
}
