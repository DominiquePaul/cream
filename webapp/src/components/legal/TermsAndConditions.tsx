import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function TermsAndConditions() {
  return (
    <Card className="max-w-4xl mx-auto">
      <CardHeader>
        <CardTitle>Terms and Conditions</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <h3 className="font-semibold mb-2">1. Acceptance of Terms</h3>
          <p>
            By accessing and using DreamStream, you agree to be bound by these Terms and Conditions. If you do not agree with any part of these terms, please do not use our service.
          </p>
        </div>

        <div>
          <h3 className="font-semibold mb-2">2. Service Description</h3>
          <p>
            DreamStream provides a platform for creating and viewing AI-stylized livestreams. The service includes:
          </p>
          <ul className="list-disc pl-6 mt-2">
            <li>Stream creation and management</li>
            <li>AI-powered video transformation</li>
            <li>Stream viewing capabilities</li>
            <li>Credit-based usage system</li>
          </ul>
        </div>

        <div>
          <h3 className="font-semibold mb-2">3. User Responsibilities</h3>
          <p>
            Users must:
          </p>
          <ul className="list-disc pl-6 mt-2">
            <li>Provide accurate account information</li>
            <li>Maintain the security of their account</li>
            <li>Comply with all applicable laws and regulations</li>
            <li>Not use the service for illegal or harmful purposes</li>
            <li>Respect intellectual property rights</li>
          </ul>
        </div>

        <div>
          <h3 className="font-semibold mb-2">4. Payment Terms</h3>
          <p>
            Users agree to:
          </p>
          <ul className="list-disc pl-6 mt-2">
            <li>Pay all fees associated with their account</li>
            <li>Maintain sufficient credits for service usage</li>
            <li>Accept our refund policy</li>
            <li>Provide valid payment information</li>
          </ul>
        </div>

        <div>
          <h3 className="font-semibold mb-2">5. Limitation of Liability</h3>
          <p>
            DreamStream is provided &quot;as is&quot; without warranties of any kind. We are not liable for any damages arising from your use of or inability to use the service.
          </p>
        </div>

        <div>
          <h3 className="font-semibold mb-2">6. Changes to Terms</h3>
          <p>
            We reserve the right to modify these terms at any time. Users will be notified of significant changes. Continued use of the service constitutes acceptance of new terms.
          </p>
        </div>

        <div>
          <h3 className="font-semibold mb-2">7. Contact</h3>
          <p>
            For questions about these terms, please contact us at:<br />
            Email: dominique@palta-labs.com<br />
            Address: Marienburger Str. 49, 50968 Cologne
          </p>
        </div>
      </CardContent>
    </Card>
  );
} 