import Link from 'next/link';
import { WatchStreamForm } from './components/WatchStreamForm';

export default function Home() {
  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold mb-8">Streaming App</h1>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Link href="/broadcast" className="block">
            <div className="bg-white rounded-lg shadow-lg p-6 hover:shadow-xl transition-shadow cursor-pointer">
              <h2 className="text-2xl font-semibold mb-4">Start Streaming</h2>
              <p className="text-gray-600">Create a new stream and share it with others</p>
            </div>
          </Link>
          
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-2xl font-semibold mb-4">Watch Stream</h2>
            <p className="text-gray-600 mb-4">Enter a stream ID to watch</p>
            <WatchStreamForm />
          </div>
        </div>
      </div>
    </div>
  );
}
