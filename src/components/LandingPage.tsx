import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowRight, Upload, Sparkles, TrendingUp, Users, CheckCircle, Brain, Target, Trophy } from "lucide-react";
import { useNavigate } from "react-router-dom";

const LandingPage = () => {
  const navigate = useNavigate();

  const stats = [
    { label: "Questions Generated", value: "10,000+" },
    { label: "Success Rate", value: "94%" },
    { label: "Tests Created", value: "1M+" },
    { label: "Active Students", value: "50K+" },
  ];

  const features = [
    {
      icon: Upload,
      title: "Upload Past Papers",
      description: "Simply upload your exam papers as PDFs and let AI extract the questions and topics"
    },
    {
      icon: Sparkles,
      title: "AI-Generated Exams",
      description: "Get personalized mock exams tailored to your syllabus and learning goals"
    },
    {
      icon: Brain,
      title: "AI Revision Coach",
      description: "Chat with your personal AI tutor for explanations, quizzes, and study tips"
    },
    {
      icon: TrendingUp,
      title: "Track Progress",
      description: "Monitor your performance with detailed analytics and improvement insights"
    },
  ];

  const testimonials = [
    {
      name: "Sarah Chen",
      role: "A-Level Student",
      content: "This platform helped me improve my grades from B to A*. The AI-generated exams are incredibly realistic!",
      avatar: "SC"
    },
    {
      name: "James Wilson",
      role: "GCSE Student",
      content: "I love how it tracks my progress and shows exactly where I need to improve. Game changer for revision!",
      avatar: "JW"
    },
    {
      name: "Amara Patel",
      role: "University Student",
      content: "The AI coach is like having a personal tutor 24/7. It explains concepts in a way that actually makes sense.",
      avatar: "AP"
    },
  ];

  return (
    <div className="min-h-screen">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-md border-b border-border">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
              <Brain className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className="text-xl font-bold">ExamAI</span>
          </div>
          <div className="hidden md:flex items-center gap-6">
            <a href="#features" className="text-sm font-medium hover:text-primary transition-colors">How It Works</a>
            <a href="#testimonials" className="text-sm font-medium hover:text-primary transition-colors">Success Stories</a>
            <a href="#pricing" className="text-sm font-medium hover:text-primary transition-colors">Pricing</a>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="ghost" onClick={() => navigate("/auth?mode=login")}>Log In</Button>
            <Button onClick={() => navigate("/auth?mode=signup")}>Sign Up</Button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-4 bg-gradient-to-b from-primary/5 to-background">
        <div className="container mx-auto max-w-6xl text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary/10 rounded-full mb-6">
            <Sparkles className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium text-primary">AI-Powered Exam Revision</span>
          </div>
          <h1 className="text-5xl md:text-7xl font-bold mb-6 leading-tight">
            Ace Your Exams with
            <span className="text-gradient block mt-2">AI-Generated Practice</span>
          </h1>
          <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
            Upload past papers, generate unlimited mock exams, and track your progress with our intelligent AI revision platform
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg" onClick={() => navigate("/auth?mode=signup")} className="button-glow">
              Start Revising Free <ArrowRight className="ml-2 w-5 h-5" />
            </Button>
            <Button size="lg" variant="outline" onClick={() => document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })}>
              See How It Works
            </Button>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-16 px-4 border-y border-border bg-muted/30">
        <div className="container mx-auto max-w-6xl">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {stats.map((stat, index) => (
              <div key={index} className="text-center">
                <div className="text-3xl md:text-4xl font-bold text-primary mb-2">{stat.value}</div>
                <div className="text-sm text-muted-foreground">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 px-4">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4">Everything You Need to Succeed</h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              From uploading papers to taking AI-generated exams, we've got your revision covered
            </p>
          </div>
          <div className="grid md:grid-cols-2 gap-8">
            {features.map((feature, index) => (
              <Card key={index} className="card-hover border-2">
                <CardContent className="p-6">
                  <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4">
                    <feature.icon className="w-6 h-6 text-primary" />
                  </div>
                  <h3 className="text-xl font-semibold mb-2">{feature.title}</h3>
                  <p className="text-muted-foreground">{feature.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20 px-4 bg-muted/30">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4">Simple 3-Step Process</h2>
            <p className="text-xl text-muted-foreground">Start revising smarter in minutes</p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              { step: "1", title: "Upload Papers", description: "Upload your past exam papers as PDFs" },
              { step: "2", title: "AI Generates", description: "Our AI analyzes and creates personalized exams" },
              { step: "3", title: "Practice & Improve", description: "Take tests, track progress, and ace your exams" },
            ].map((item, index) => (
              <div key={index} className="text-center">
                <div className="w-16 h-16 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-2xl font-bold mx-auto mb-4">
                  {item.step}
                </div>
                <h3 className="text-xl font-semibold mb-2">{item.title}</h3>
                <p className="text-muted-foreground">{item.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section id="testimonials" className="py-20 px-4">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4">Loved by Students</h2>
            <p className="text-xl text-muted-foreground">See what students are saying about ExamAI</p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {testimonials.map((testimonial, index) => (
              <Card key={index} className="border-2">
                <CardContent className="p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center font-semibold text-primary">
                      {testimonial.avatar}
                    </div>
                    <div>
                      <div className="font-semibold">{testimonial.name}</div>
                      <div className="text-sm text-muted-foreground">{testimonial.role}</div>
                    </div>
                  </div>
                  <p className="text-muted-foreground italic">"{testimonial.content}"</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-20 px-4 bg-muted/30">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4">Simple, Transparent Pricing</h2>
            <p className="text-xl text-muted-foreground">Start free, upgrade when you need more</p>
          </div>
          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            <Card className="border-2">
              <CardContent className="p-8">
                <div className="text-center mb-6">
                  <h3 className="text-2xl font-bold mb-2">Free</h3>
                  <div className="text-4xl font-bold mb-2">£0<span className="text-lg text-muted-foreground">/month</span></div>
                  <p className="text-muted-foreground">Perfect for getting started</p>
                </div>
                <ul className="space-y-3 mb-6">
                  {["1 exam per month", "Basic progress tracking", "AI Revision Coach", "Upload up to 3 papers"].map((feature, i) => (
                    <li key={i} className="flex items-center gap-2">
                      <CheckCircle className="w-5 h-5 text-success" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
                <Button className="w-full" variant="outline" onClick={() => navigate("/auth?mode=signup")}>Get Started Free</Button>
              </CardContent>
            </Card>
            <Card className="border-2 border-primary shadow-lg relative">
              <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2">
                <div className="bg-secondary text-secondary-foreground px-4 py-1 rounded-full text-sm font-semibold">
                  Most Popular
                </div>
              </div>
              <CardContent className="p-8">
                <div className="text-center mb-6">
                  <h3 className="text-2xl font-bold mb-2">Pro</h3>
                  <div className="text-4xl font-bold mb-2">£9.99<span className="text-lg text-muted-foreground">/month</span></div>
                  <p className="text-muted-foreground">For serious students</p>
                </div>
                <ul className="space-y-3 mb-6">
                  {["Unlimited exams", "Advanced analytics", "Priority AI Coach", "Unlimited file uploads", "Leaderboard access", "Download & print exams"].map((feature, i) => (
                    <li key={i} className="flex items-center gap-2">
                      <CheckCircle className="w-5 h-5 text-success" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
                <Button className="w-full button-glow" onClick={() => navigate("/auth?mode=signup")}>Start Pro Trial</Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4">
        <div className="container mx-auto max-w-4xl">
          <Card className="border-2 border-primary bg-gradient-to-br from-primary/5 to-secondary/5">
            <CardContent className="p-12 text-center">
              <Trophy className="w-16 h-16 text-primary mx-auto mb-6" />
              <h2 className="text-4xl font-bold mb-4">Ready to Ace Your Exams?</h2>
              <p className="text-xl text-muted-foreground mb-8">
                Join thousands of students who are revising smarter with AI
              </p>
              <Button size="lg" onClick={() => navigate("/auth?mode=signup")} className="button-glow">
                Start Your Free Trial <ArrowRight className="ml-2 w-5 h-5" />
              </Button>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-12 px-4 bg-muted/30">
        <div className="container mx-auto max-w-6xl">
          <div className="grid md:grid-cols-4 gap-8 mb-8">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                  <Brain className="w-5 h-5 text-primary-foreground" />
                </div>
                <span className="text-xl font-bold">ExamAI</span>
              </div>
              <p className="text-sm text-muted-foreground">
                AI-powered exam revision for students who want to succeed
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Product</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="#features" className="hover:text-primary transition-colors">Features</a></li>
                <li><a href="#pricing" className="hover:text-primary transition-colors">Pricing</a></li>
                <li><a href="#testimonials" className="hover:text-primary transition-colors">Testimonials</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Company</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="#" className="hover:text-primary transition-colors">About</a></li>
                <li><a href="#" className="hover:text-primary transition-colors">Blog</a></li>
                <li><a href="#" className="hover:text-primary transition-colors">Contact</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Legal</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="#" className="hover:text-primary transition-colors">Privacy</a></li>
                <li><a href="#" className="hover:text-primary transition-colors">Terms</a></li>
                <li><a href="#" className="hover:text-primary transition-colors">Cookie Policy</a></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-border pt-8 text-center text-sm text-muted-foreground">
            © 2025 ExamAI. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
