import React, { useState, useEffect } from 'react';
import Head from 'next/head';
import { TonConnectButton, TonConnectUIProvider } from '@tonconnect/ui-react';

export default function Home() {
  const [markets, setMarkets] = useState([]);
  const [user, setUser] = useState(null);
  const [balance, setBalance] = useState(1000); // 初始模拟资金

  useEffect(() => {
    // 1. 初始化 Telegram WebApp
    if (window.Telegram?.WebApp) {
      const tg = window.Telegram.WebApp;
      tg.ready();
      setUser(tg.initDataUnsafe?.user);
    }

    // 2. 获取 Polymarket 数据 (Gamma API)
    fetch('https://gamma-api.polymarket.com/events?limit=10&active=true')
      .then(res => res.json())
      .then(data => setMarkets(data))
      .catch(err => console.error("API获取失败:", err));
  }, []);

  const handleBet = (marketTitle) => {
    if (balance <= 0) return alert("余额不足");
    setBalance(prev => prev - 10);
    alert(`在 [${marketTitle}] 模拟下注 10u 成功！`);
  };

  return (
    <TonConnectUIProvider manifestUrl="https://ton-connect.github.io/demo-dapp-with-react-ui/tonconnect-manifest.json">
      <div style={{ padding: '20px', fontFamily: 'sans-serif', backgroundColor: '#f4f4f4', minHeight: '100vh' }}>
        <Head>
          <title>Polymarket TG Demo</title>
          <script src="https://telegram.org/js/telegram-web-app.js"></script>
        </Head>

        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div>
            <h3>你好, {user ? user.first_name : '用户'}</h3>
            <p>模拟余额: <span style={{color: 'green', fontWeight: 'bold'}}>${balance}</span></p>
          </div>
          <TonConnectButton />
        </header>

        <h2>热门预测市场</h2>
        <div style={{ display: 'grid', gap: '15px' }}>
          {markets.map((event, idx) => (
            <div key={idx} style={{ background: '#fff', padding: '15px', borderRadius: '12px', boxShadow: '0 2px 5px rgba(0,0,0,0.1)' }}>
              <h4 style={{ margin: '0 0 10px 0' }}>{event.title}</h4>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button onClick={() => handleBet(event.title)} style={{ flex: 1, padding: '10px', backgroundColor: '#007aff', color: '#fff', border: 'none', borderRadius: '8px' }}>
                  模拟下注 (Yes)
                </button>
                <button onClick={() => handleBet(event.title)} style={{ flex: 1, padding: '10px', backgroundColor: '#ff3b30', color: '#fff', border: 'none', borderRadius: '8px' }}>
                  模拟下注 (No)
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </TonConnectUIProvider>
  );
}
