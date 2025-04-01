import Impressum from "@/components/legal/Impressum";
import PrivacyPolicy from "@/components/legal/PrivacyPolicy";
import TermsAndConditions from "@/components/legal/TermsAndConditions";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function LegalPage() {
  return (
    <main className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">Legal Information</h1>
      
      <Tabs defaultValue="legal-notice" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="legal-notice">Legal Notice</TabsTrigger>
          <TabsTrigger value="privacy">Privacy Policy</TabsTrigger>
          <TabsTrigger value="terms">Terms & Conditions</TabsTrigger>
        </TabsList>
        
        <TabsContent value="legal-notice" className="mt-6">
          <Impressum />
        </TabsContent>
        
        <TabsContent value="privacy" className="mt-6">
          <PrivacyPolicy />
        </TabsContent>
        
        <TabsContent value="terms" className="mt-6">
          <TermsAndConditions />
        </TabsContent>
      </Tabs>
    </main>
  );
} 