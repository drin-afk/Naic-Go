import { Link } from 'react-router-dom';
import { MapPinOff } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="container-page grid min-h-[60vh] place-items-center py-16 text-center">
      <div>
        <div className="mx-auto w-fit rounded-2xl bg-maroon-50 p-4 text-maroon"><MapPinOff className="h-10 w-10" /></div>
        <h1 className="mt-5 text-3xl">This stop isn&apos;t on our map</h1>
        <p className="mt-2 text-muted">The page you are looking for doesn&apos;t exist or has moved.</p>
        <div className="mt-6 flex justify-center gap-3">
          <Link to="/" className="btn-primary">Go home</Link>
          <Link to="/routes" className="btn-secondary">Find a route</Link>
        </div>
      </div>
    </div>
  );
}
