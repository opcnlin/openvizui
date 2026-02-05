import Terminal from '../components/Terminal';

const TerminalPage = () => {
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', padding: '0 16px 16px 16px' }}>
      <div style={{ flex: 1, overflow: 'hidden' }}>
        <Terminal />
      </div>
    </div>
  );
};

export default TerminalPage;
