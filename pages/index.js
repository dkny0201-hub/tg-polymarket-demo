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
    // 1. 自动登录逻辑：优先获取原生 TG 账号上下文
    if (window.Telegram?.WebApp) {
      const tg = window.Telegram.WebApp;
      tg.ready();
      tg.expand();
      tg.setHeaderColor(COLORS.bg);
      
      const user = tg.initDataUnsafe?.user;
      if (user) {
        setTgUser(user);
        const savedData = localStorage.getItem(`tg_user_${user.id}`);
        if (savedData) {
          setAccountData(JSON.parse(savedData));
        } else {
          const initData = { balance: 1000, history: [] };
          localStorage.setItem(`tg_user_${user.id}`, JSON.stringify(initData));
          setAccountData(initData);
        }
      } else {
        // TG 内环境但未获取到用户数据（例如 Web 预览模式）
        loadMockAccount('tg_preview_user');
      }
    } else {
      // 外部普通浏览器打开，自动登录本地测试账号以便调试
      loadMockAccount('web_debug_user');
    }

    function loadMockAccount(mockId) {
      setTgUser({ id: mockId, first_name: '开发者测试', username: 'dev_test' });
      const savedData = localStorage.getItem(`tg_user_${mockId}`);
      if (savedData) {
        setAccountData(JSON.parse(savedData));
      } else {
        const initData = { balance: 1000, history: [] };
        localStorage.setItem(`tg_user_${mockId}`, JSON.stringify(initData));
        setAccountData(initData);
      }
    }

    // 2. 获取 Polymarket 实时数据并做清洗封装
    fetch('https://gamma-api.polymarket.com/events?limit=5&active=true')
      .then(res => res.json())
      .then(data => {
        // 动态注入交易总量和下注价格数据字段
        const enhancedMarkets = data.map(event => {
          // 预估单盘交易量（生成一个百万级别的真实感数据）
          const mockVolume = event.volume ? event.volume : (Math.random() * 5 + 1) * 1000000;
          // 动态计算当前 Yes 价格（对应胜率百分比，如 0.65u 代表 65% 概率）
          const mockYesPrice = (0.3 + Math.random() * 0.5).toFixed(2);
          const mockNoPrice = (1.0 - mockYesPrice).toFixed(2);

          return {
            ...event,
            totalVolume: mockVolume,
            yesPrice: mockYesPrice,
            noPrice: mockNoPrice
          };
        });
        setMarkets(enhancedMarkets);
      })
      .catch(err => console.error("数据获取失败:", err));
  }, []);

  // 模拟下注处理
  const handleBet = (marketTitle, type, currentPrice) => {
    if (accountData.balance <= 0) {
      if (window.Telegram?.WebApp) window.Telegram.WebApp.showAlert("您的TG账户模拟余额不足！");
      else alert("余额不足");
      return;
    }

    const betAmount = 50;
    const updatedData = {
      balance: accountData.balance - betAmount,
      history: [...accountData.history, { 
        title: marketTitle, 
        type, 
        amount: betAmount, 
        price: currentPrice,
        time: new Date().toLocaleTimeString() 
      }]
    };

    setAccountData(updatedData);

    if (tgUser) {
      localStorage.setItem(`tg_user_${tgUser.id}`, JSON.stringify(updatedData));
    }

    if (window.Telegram?.WebApp) {
      window.Telegram.WebApp.showPopup({
        title: '下注成功',
        message: `用户已成功以 $${currentPrice} 的价格买入 ${type} 仓位 (${betAmount}u)`,
        buttons: [{ type: 'ok' }]
      });
    }
  };

  // 格式化数字为含有 $ 和 M/K 的字符串
  const formatVolume = (num) => {
    if (num >= 1000000) return `$${(num / 1000000).toFixed(2)}M`;
    if (num >= 1000) return `$${(num / 1000).toFixed(2)}K`;
    return `$${num.toFixed(2)}`;
  };

  return (
    <TonConnectUIProvider manifestUrl="https://ton-connect.github.io/demo-dapp-with-react-ui/tonconnect-manifest.json">
      <div style={{ padding: '16px', fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif', backgroundColor: COLORS.bg, color: COLORS.text, minHeight: '100vh' }}>
        <Head>
          <title>Polymarket Pro Demo</title>
          <script src="https://telegram.org/js/telegram-web-app.js"></script>
          <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
        </Head>

        {/* 顶部身份自动登陆区 */}
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', padding: '12px', background: COLORS.cardBg, borderRadius: '12px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontWeight: '600', fontSize: '15px' }}>{tgUser ? `@${tgUser.username || tgUser.first_name}` : '自动登录中...'}</span>
            </div>
            <p style={{ margin: '4px 0 0 0', fontSize: '11px', color: COLORS.textSecondary }}>
              UID: <code style={{ background: '#21262d', padding: '2px 4px', borderRadius: '4px' }}>{tgUser ? tgUser.id : '---'}</code>
            </p>
            <p style={{ margin: '6px 0 0 0', fontSize: '14px', fontWeight: 'bold', color: '#fff' }}>
              模拟账户: <span style={{ color: COLORS.green }}>${accountData.balance} u</span>
            </p>
          </div>
          <TonConnectButton />
        </header>

        {/* 预测市场列表 */}
        <h3 style={{ fontSize: '16px', marginBottom: '12px', paddingLeft: '4px' }}>预测盘口行情</h3>
        <div style={{ display: 'grid', gap: '16px' }}>
          {markets.map((event, idx) => (
            <div key={idx} style={{ background: COLORS.cardBg, padding: '16px', borderRadius: '14px', border: '1px solid #21262d' }}>
              {/* 标题 */}
              <h4 style={{ margin: '0 0 6px 0', fontSize: '14px', fontWeight: '600', lineHeight: '1.4', color: '#fff' }}>{event.title}</h4>
              
              {/* 数据展示看板：交易总量 */}
              <div style={{ display: 'flex', gap: '12px', fontSize: '12px', color: COLORS.textSecondary, marginBottom: '8px' }}>
                <span>交易总量: <strong style={{ color: COLORS.accent }}>{formatVolume(event.totalVolume)}</strong></span>
              </div>
              
              {/* 嵌入 K 线图 */}
              <MiniKLine marketId={event.id || idx} />

              {/* 如下注按钮及当前下注价格展示 */}
              <div style={{ display: 'flex', gap: '10px', marginTop: '12px' }}>
                <button 
                  onClick={() => handleBet(event.title, 'YES', event.yesPrice)} 
                  style={{ flex: 1, padding: '10px', backgroundColor: COLORS.green, color: '#fff', border: 'none', borderRadius: '8px', fontWeight: '600', fontSize: '13px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}
                >
                  <span>买入 YES</span>
                  <span style={{ fontSize: '11px', opacity: 0.9, marginTop: '2px' }}>当前价: ${event.yesPrice}</span>
                </button>
                
                <button 
                  onClick={() => handleBet(event.title, 'NO', event.noPrice)} 
                  style={{ flex: 1, padding: '10px', backgroundColor: COLORS.red, color: '#fff', border: 'none', borderRadius: '8px', fontWeight: '600', fontSize: '13px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}
                >
                  <span>买入 NO</span>
                  <span style={{ fontSize: '11px', opacity: 0.9, marginTop: '2px' }}>当前价: ${event.noPrice}</span>
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* 下注单据历史 */}
        {accountData.history.length > 0 && (
          <div style={{ marginTop: '24px', background: COLORS.cardBg, padding: '16px', borderRadius: '14px', border: '1px solid #21262d' }}>
            <h4 style={{ margin: '0 0 10px 0', fontSize: '14px', color: '#fff' }}>当前账号交易历史</h4>
            <div style={{ fontSize: '12px', color: COLORS.textSecondary }}>
              {accountData.history.map((h, i) => (
                <div key={i} style={{ padding: '6px 0', borderBottom: '1px solid #21262d', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ maxWidth: '50%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{h.title}</span>
                  <span style={{ fontSize: '11px', color: COLORS.textSecondary }}>{h.time}</span>
                  <span style={{ color: h.type === 'YES' ? COLORS.green : COLORS.red }}>
                    {h.type} (${h.amount}u) @${h.price}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </TonConnectUIProvider>
  );
}
