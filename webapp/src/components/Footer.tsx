import Link from "next/link";

export default function Footer() {
  return (
    <footer className="bg-gray-50 border-t">
      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Company Info */}
          <div>
            <h3 className="font-semibold mb-4">DreamStream</h3>
            <p className="text-sm text-gray-600">
              Transform your livestreams with AI-powered artistic styles.
            </p>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="font-semibold mb-4">Quick Links</h3>
            <ul className="space-y-2">
              <li>
                <Link href="/stream" className="text-sm text-gray-600 hover:text-gray-900">
                  Start Streaming
                </Link>
              </li>
              <li>
                <Link href="/pricing" className="text-sm text-gray-600 hover:text-gray-900">
                  Pricing
                </Link>
              </li>
              <li>
                <a href="https://x.com/DominiqueCAPaul" className="text-sm text-gray-600 hover:text-gray-900">
                  Follow me on X for product updates
                </a>
              </li>
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h3 className="font-semibold mb-4">Legal</h3>
            <ul className="space-y-2">
              <li>
                <Link href="/legal" className="text-sm text-gray-600 hover:text-gray-900">
                  Legal Notice
                </Link>
              </li>
              <li>
                <Link href="/legal#privacy" className="text-sm text-gray-600 hover:text-gray-900">
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link href="/legal#terms" className="text-sm text-gray-600 hover:text-gray-900">
                  Terms & Conditions
                </Link>
              </li>
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h3 className="font-semibold mb-4">Contact</h3>
            <ul className="space-y-2">
              <li>
                <a href="mailto:dominique@palta-labs.com" className="text-sm text-gray-600 hover:text-gray-900">
                  Email Us
                </a>
              </li>
              <li className="text-sm text-gray-600">
                Marienburger Str. 49<br />
                50968 Cologne<br />
                Germany
              </li>
            </ul>
          </div>
        </div>

        {/* Copyright */}
        <div className="mt-8 pt-8 border-t text-center text-sm text-gray-600">
          <p>© {new Date().getFullYear()} DreamStream. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
} 