import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import Home from './pages/Home';
import Workspace from './pages/Workspace';
import SocketProvider from './context/SocketProvider';

function App() {
  return (
    <BrowserRouter>
      <SocketProvider>
        <div className="min-h-screen bg-[#0A0A0A] text-white">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/room/:roomId" element={<Workspace />} />
          </Routes>
        </div>
        <Toaster position="bottom-right" toastOptions={{
          style: {
            background: '#1A1A1A',
            color: '#fff',
            border: '1px solid rgba(255,255,255,0.1)',
          }
        }}/>
      </SocketProvider>
    </BrowserRouter>
  );
}

export default App;
