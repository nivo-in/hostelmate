export function LoadingSpinner() {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '12px',
        padding: '48px 24px',
      }}
    >
      <div
        style={{
          width: '22px',
          height: '22px',
          border: '2px solid rgba(255,255,255,0.1)',
          borderTopColor: 'rgba(124,92,252,0.9)',
          borderRadius: '50%',
          animation: 'hmSpin 0.7s linear infinite',
        }}
      />
      <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.3)', margin: 0 }}>Loading…</p>
      <style>{`@keyframes hmSpin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
