import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

export default function Verification() {
  return (
    <div className="container mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Pay Verification</h1>
        <Button>Add Actual Pay</Button>
      </div>
      
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Current Pay Period</CardTitle>
            <CardDescription>
              Compare calculated vs actual pay for the current period
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="text-center">
                <p className="text-sm font-medium text-muted-foreground">Calculated</p>
                <p className="text-2xl font-bold">$1,245.50</p>
              </div>
              <div className="text-center">
                <p className="text-sm font-medium text-muted-foreground">Actual</p>
                <p className="text-2xl font-bold text-muted-foreground">Not entered</p>
              </div>
              <div className="text-center">
                <p className="text-sm font-medium text-muted-foreground">Difference</p>
                <p className="text-2xl font-bold text-muted-foreground">-</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Previous Verifications</CardTitle>
              <CardDescription>History of pay comparisons</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                No previous verifications. Add your actual pay to start tracking accuracy.
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle>Accuracy Stats</CardTitle>
              <CardDescription>How accurate are the calculations?</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Average difference</span>
                <span className="text-sm text-muted-foreground">-</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Verified periods</span>
                <span className="text-sm text-muted-foreground">0</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Accuracy rate</span>
                <span className="text-sm text-muted-foreground">-</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}