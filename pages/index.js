import React, { useState, useEffect, useRef } from 'react';
import Head from 'next/head';
import { TonConnectButton, TonConnectUIProvider } from '@tonconnect/ui-react';

const COLORS = {
  bg: '#0d1117',
  cardBg: '#161b22',
  text: '#c9d1d9',
  textSecondary: '#8b949e',
  accent: '#58a6ff',
  green: '#2ea44f',
  red: '#da3633',
  chartUp: '#26a69a',
  chartDown: '#ef5350'
};

// 封装轻量级 K 线图组件
function MiniKLine({ marketId }) {
  const chartContainerRef = useRef();

  useEffect(() => {
    if (!chartContainerRef.current) return;

    // 动态加载 TradingView Lightweight Charts (避免 SSR 报错)
    import('lightweight-charts').then(({ createChart }) => {
      const chart = createChart(chartContainerRef.current, {
        width: chartContainerRef.current.clientWidth || 300,
        height: 150,
        layout: { background: { color: COLORS.cardBg }, textColor: COLORS.textSecondary },
        grid: { vertLines: { visible: false }, horzLines: { color: '#21262d' } },
        crosshair: { visible: false },
        rightPriceScale: { borderVisible: false },
        timeScale: { borderVisible: false },
      });

      const candlestickSeries = chart.addCandlestickSeries({
        upColor: COLORS.chartUp, downColor: COLORS.chartDown,
        borderUpColor: COLORS.chartUp, borderDownColor: COLORS.chartDown,
        wickUpColor: COLORS.chartUp, wickDownColor: COLORS.chartDown,
      });

      // 生成模拟的盘口历史 K 线数据 (Polymarket 价格在 0-1 之间波动，这里放大到 0-100 方便看)
      const data = [];
      let basePrice = 40 + Math.random() * 20;
      const now = new Date();
      for (let i = 30; i >= 0; i--) {
        const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
        const open = basePrice + (Math.random() - 0.5) * 5;
        const close = open + (Math.random() - 0.5) * 6;
        const high = Math.max(open, close) + Math.random() * 3;
        const low = Math.min(open, close) - Math.random() * 3;
        data.push({
          time: d.toISOString().split('T')[0],
          open: parseFloat(open.toFixed(2)),
          high: parseFloat(high.toFixed(2)),
          low: parseFloat(low.toFixed(2)),
          close: parseFloat(close.toFixed(2)),
        });
        basePrice = close;
      }

      candlestickSeries.setData(data);
      chart.timeScale().fitContent();

      const handleResize = () => {
        chart.applyOptions({ width: chartContainerRef.current.clientWidth });
      };
      window.addEventListener('resize', handleResize);

      return () => {
        window.removeEventListener('resize', handleResize);
        chart.remove();
      };
    });
  }, [marketId]);

  return <div ref={chartContainerRef} style={{ width: '100%', height: '150px', marginTop: '10px', borderRadius: '8px', overflow: 'hidden' }} />;
}

export default function Home() {
  const [markets, setMarkets] = useState([]);
  const [tgUser, setTgUser] = useState(null);
  const [accountData, setAccountData] = useState({ balance: 1000, history: [] });

  useEffect(() => {
    // 1. 打通 TG 账号：通过 WebApp 获取原生账号信息
    if (window.Telegram?.WebApp) {
      const tg = window.Telegram.WebApp;
      tg.ready();
      tg.expand();
      tg.setHeaderColor(COLORS.bg);
      
      const user = tg.initDataUnsafe?.user;
      if (user) {
        setTgUser(user);
        // 使用 TG 用户的唯一 ID 作为 Key，打通并持久化本地账户数据
        const savedData = localStorage.getItem(`tg_user_${user.id}`);
        if (savedData) {
          setAccountData(JSON.parse(savedData));
        } else {
          const initData = { balance: 1000, history: [] };
          localStorage.setItem(`tg_user_${user.id}`, JSON.stringify(initData));
          setAccountData(initData);
        }
      }
    }

    // 2. 获取 Polymarket 实时数据
    fetch('https://gamma-api.polymarket.com/events?limit=5&active=true')
      .then(res => res.json())
      .then(data => setMarkets(data))
      .catch(err => console.error("数据获取失败:", err));
  }, []);

  // 模拟下注并更新与该 TG 账号绑定的资产
  const handleBet = (marketTitle, type) => {
    if (accountData.balance <= 0) {
      if (window.Telegram?.WebApp) window.Telegram.WebApp.showAlert("您的TG账户模拟余额不足！");
      else alert("余额不足");
      return;
    }

    const updatedData = {
      balance: accountData.balance - 50,
      history: [...accountData.history, { title: marketTitle, type, amount: 50, time: new Date().toLocaleTimeString() }]
    };

    setAccountData(updatedData);

    // 将变动持久化保存到该 TG 用户名下
    if (tgUser) {
      localStorage.setItem(`tg_user_${tgUser.id}`, JSON.stringify(updatedData));
    }

    if (window.Telegram?.WebApp) {
      window.Telegram.WebApp.showPopup({
        title: '下注成功',
        message: `TG用户 [${tgUser?.first_name || '未知'}] 已成功为 [${marketTitle}] 投下 50u (${type})`,
        buttons: [{ type: 'ok' }]
      });
    }
  };

  return (
    <TonConnectUIProvider manifestUrl="https://ton-connect.github.io/demo-dapp-with-react-ui/tonconnect-manifest.json">
      <div style={{ padding: '16px', fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif', backgroundColor: COLORS.bg, color: COLORS.text, minHeight: '100vh' }}>
        <Head>
          <title>Polymarket Pro Demo</title>
          <script src="https://telegram.org/js/telegram-web-app.js"></script>
          <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
        </Head>

        {/* 用户信息看板：完美打通 TG 身份 */}
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', padding: '12px', background: COLORS.cardBg, borderRadius: '12px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {tgUser?.photo_url && <img src={tgUser.photo_url} style={{ width: '24px', height: '24px', borderRadius: '50%' }} />}
              <span style={{ fontWeight: '600', fontSize: '15px' }}>{tgUser ? `@${tgUser.username || tgUser.first_name}` : '未识别TG账号'}</span>
            </div>
            <p style={{ margin: '6px 0 0 0', fontSize: '13px', color: COLORS.textSecondary }}>
              UID: <code style={{ background: '#21262d', padding: '2px 4px', borderRadius: '4px' }}>{tgUser ? tgUser.id : '123456'}</code>
            </p>
            <p style={{ margin: '4px 0 0 0', fontSize: '14px', fontWeight: 'bold', color: '#fff' }}>
              账户余额: <span style={{ color: COLORS.green }}>${accountData.balance} u</span>
            </p>
          </div>
          <TonConnectButton />
        </header>

        {/* 预测市场列表 */}
        <h3 style={{ fontSize: '16px', marginBottom: '12px', paddingLeft: '4px' }}>预测市场 (附实时变动K线)</h3>
        <div style={{ display: 'grid', gap: '16px' }}>
          {markets.map((event, idx) => (
            <div key={idx} style={{ background: COLORS.cardBg, padding: '16px', borderRadius: '14px', border: '1px solid #21262d' }}>
              <h4 style={{ margin: '0 0 8px 0', fontSize: '14px', fontWeight: '600', lineHeight: '1.4', color: '#fff' }}>{event.title}</h4>
              
              {/* 嵌入 K 线图 */}
              <MiniKLine marketId={event.id || idx} />

              <div style={{ display: 'flex', gap: '10px', marginTop: '12px' }}>
                <button onClick={() => handleBet(event.title, 'YES')} style={{ flex: 1, padding: '10px', backgroundColor: COLORS.green, color: '#fff', border: 'none', borderRadius: '8px', fontWeight: '600', fontSize: '13px' }}>
                  买入 YES (看涨)
                </button>
                <button onClick={() => handleBet(event.title, 'NO')} style={{ flex: 1, padding: '10px', backgroundColor: COLORS.red, color: '#fff', border: 'none', borderRadius: '8px', fontWeight: '600', fontSize: '13px' }}>
                  买入 NO (看跌)
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* 如下注过，则展示当前 TG 账号的历史单据 */}
        {accountData.history.length > 0 && (
          <div style={{ marginTop: '24px', background: COLORS.cardBg, padding: '16px', borderRadius: '14px', border: '1px solid #21262d' }}>
            <h4 style={{ margin: '0 0 10px 0', fontSize: '14px', color: '#fff' }}>当前账号下注记录</h4>
            <div style={{ fontSize: '12px', color: COLORS.textSecondary }}>
              {accountData.history.map((h, i) => (
                <div key={i} style={{ padding: '6px 0', borderBottom: '1px solid #21262d', display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ maxWidth: '60%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{h.title}</span>
                  <span style={{ color: h.type === 'YES' ? COLORS.green : COLORS.red }}>{h.type} (${h.amount}u)</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </TonConnectUIProvider>
  );
}
