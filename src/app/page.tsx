import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

export default function Home() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-background to-muted">
      <div className="container mx-auto px-4 py-16">
        <div className="text-center">
          <h1 className="text-4xl font-bold mb-4">
            Welcome to Chrona
          </h1>
          <p className="text-xl text-muted-foreground mb-8">
            Australian Casual Pay Tracking & Forecasting
          </p>
          <div className="max-w-2xl mx-auto">
            <p className="text-muted-foreground mb-6">
              Track your casual work, calculate pay with customizable rates and Australian tax rules, 
              and forecast your earnings based on your roster.
            </p>
            
            <div className="flex gap-4 justify-center mb-12">
              <Button size="lg" asChild>
                <Link href="/settings">Get Started</Link>
              </Button>
              <Button variant="outline" size="lg" asChild>
                <Link href="/dashboard">View Dashboard</Link>
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-12">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Custom Pay Rates</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription>
                    Configure your hourly rates, overtime, and penalty rates to match your employment conditions.
                  </CardDescription>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Australian Tax</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription>
                    Accurate tax calculations including HECS debt, Medicare levy, and personal tax brackets.
                  </CardDescription>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Pay Verification</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription>
                    Compare calculated pay with actual payments to ensure accuracy and catch discrepancies.
                  </CardDescription>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}