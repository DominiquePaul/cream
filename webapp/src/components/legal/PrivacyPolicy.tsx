import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function PrivacyPolicy() {
  return (
    <Card className="max-w-4xl mx-auto">
      <CardHeader>
        <CardTitle>Privacy Policy</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <h3 className="font-semibold mb-2">1. Data Protection Overview</h3>
          <p>
            The following information provides a simple overview of what happens to your personal data when you visit our website. Personal data is any data that can personally identify you.
          </p>
        </div>

        <div>
          <h3 className="font-semibold mb-2">2. Data Collection on Our Website</h3>
          <p>
            We collect data that you provide directly to us, including:
          </p>
          <ul className="list-disc pl-6 mt-2">
            <li>Account information (email, username)</li>
            <li>Stream data and content</li>
            <li>Payment information</li>
            <li>Usage data and analytics</li>
          </ul>
        </div>

        <div>
          <h3 className="font-semibold mb-2">3. Your Rights</h3>
          <p>
            You have the right to:
          </p>
          <ul className="list-disc pl-6 mt-2">
            <li>Access your personal data</li>
            <li>Correct inaccurate data</li>
            <li>Request deletion of your data</li>
            <li>Object to data processing</li>
            <li>Data portability</li>
          </ul>
        </div>

        <div>
          <h3 className="font-semibold mb-2">4. Data Security</h3>
          <p>
            We implement appropriate technical and organizational security measures to protect your personal data against accidental or intentional manipulation, loss, destruction, or unauthorized access.
          </p>
        </div>

        <div>
          <h3 className="font-semibold mb-2">5. Contact</h3>
          <p>
            For any questions regarding data protection, please contact us at:<br />
            Email: dominique@palta-labs.com<br />
            Address: Marienburger Str. 49, 50968 Cologne
          </p>
        </div>
      </CardContent>
    </Card>
  );
} 