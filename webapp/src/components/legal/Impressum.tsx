import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function Impressum() {
  return (
    <Card className="max-w-4xl mx-auto">
      <CardHeader>
        <CardTitle>Legal Notice</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <h3 className="font-semibold mb-2">Information pursuant to § 5 TMG</h3>
          <p>
            Dominique Paul<br />
            Marienburger Str. 49<br />
            50968 Cologne<br />
            Germany
          </p>
        </div>

        <div>
          <h3 className="font-semibold mb-2">Contact</h3>
          <p>
            Email: dominique@palta-labs.com<br />
            Website: https://palta-labs.com
          </p>
        </div>

        <div>
          <h3 className="font-semibold mb-2">Content Responsibility pursuant to § 55 Abs. 2 RStV</h3>
          <p>Dominique Paul</p>
        </div>

        <div>
          <h3 className="font-semibold mb-2">Disclaimer</h3>
          <p>
            Content Liability:<br />
            The contents of our pages have been created with utmost care. However, we cannot guarantee the accuracy, completeness, and timeliness of the content.
          </p>
        </div>

        <div>
          <h3 className="font-semibold mb-2">Copyright</h3>
          <p>
            The content and works created by the site operators on these pages are subject to German copyright law. Duplication, processing, distribution, or any form of commercialization of such material beyond the scope of the copyright law shall require the prior written consent of its respective author or creator.
          </p>
        </div>
      </CardContent>
    </Card>
  );
} 