import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export default function Home() {
  return (
    <div className="container-fluid mobile-container py-4">
      <div className="row justify-content-center">
        <div className="col-12">
          <h1 className="display-4 fw-bold text-center mb-5">
            Welcome to Chrona
          </h1>
        </div>
        <div className="col-12 col-md-6 col-lg-4">
          <Card hover>
            <CardHeader>
              <CardTitle className="mb-2">Australian Pay Tracker</CardTitle>
              <CardDescription className="text-muted">
                Track your casual pay, forecast earnings, and verify payments
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button fullWidth size="lg">Get Started</Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}