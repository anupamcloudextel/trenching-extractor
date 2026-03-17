"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ArrowRight, Brain, Loader2, Lock, Shield, Sparkles } from "lucide-react"
import { useState } from "react"
import { useMsal } from "@azure/msal-react"
import { loginRequest } from "../../msalConfig"
import Image from "next/image"

export function SignInPage() {
  const { instance, inProgress } = useMsal();
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const onLogin = async () => {
    setIsLoggingIn(true);
    try {
      // Use redirect flow instead of nested popups to avoid BrowserAuthError: block_nested_popups
      await instance.loginRedirect(loginRequest);
    } catch (err) {
      console.error("Login failed", err);
      setIsLoggingIn(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0a0a0a] px-8">
      {/* Left Side - Hero Content */}
      <div className="flex-1 flex flex-col justify-center items-end pr-6"> {/* Reduced pr-16 to pr-6 */}
        <div className="max-w-2xl w-full">
          <h1 className="text-5xl font-extrabold text-white mb-8 leading-tight tracking-tight">
            CloudExtel's <span className="text-cyan-400">Budget Analysis & Approval Hub</span>
          </h1>

          <p className="text-xl text-gray-300 mb-8 leading-relaxed font-normal">
            AI platform for parsing, analyzing, and approving municipal budgets. Instantly compare <span className="text-cyan-300 font-semibold">budgeted</span> vs <span className="text-white font-semibold">actuals</span>, unlock <span className="text-cyan-300 font-semibold">savings</span>, and drive smarter decisions.
          </p>

          {/* Feature Highlights - Modern SaaS style */}
          <div className="grid grid-cols-2 gap-x-8 gap-y-6 mb-2">
            <div className="flex items-center">
              <div className="rounded-xl bg-[#10151a] border border-cyan-900/40 shadow-md px-5 py-4 flex items-center w-full transition-transform hover:-translate-y-1 hover:shadow-cyan-500/20 hover:border-cyan-400/60">
                <Brain className="h-7 w-7 text-cyan-400 mr-4 drop-shadow-cyan" />
                <span className="text-lg font-medium text-white tracking-tight">AI Parsing</span>
              </div>
            </div>
            <div className="flex items-center">
              <div className="rounded-xl bg-[#10151a] border border-cyan-900/40 shadow-md px-5 py-4 flex items-center w-full transition-transform hover:-translate-y-1 hover:shadow-cyan-500/20 hover:border-cyan-400/60">
                <Sparkles className="h-7 w-7 text-cyan-400 mr-4 drop-shadow-cyan" />
                <span className="text-lg font-medium text-white tracking-tight">Budget vs Actuals</span>
              </div>
            </div>
            <div className="flex items-center">
              <div className="rounded-xl bg-[#10151a] border border-cyan-900/40 shadow-md px-5 py-4 flex items-center w-full transition-transform hover:-translate-y-1 hover:shadow-cyan-500/20 hover:border-cyan-400/60">
                <ArrowRight className="h-7 w-7 text-cyan-400 mr-4 drop-shadow-cyan" />
                <span className="text-lg font-medium text-white tracking-tight">Savings Calc</span>
              </div>
            </div>
            <div className="flex items-center">
              <div className="rounded-xl bg-[#10151a] border border-cyan-900/40 shadow-md px-5 py-4 flex items-center w-full transition-transform hover:-translate-y-1 hover:shadow-cyan-500/20 hover:border-cyan-400/60">
                <Lock className="h-7 w-7 text-cyan-400 mr-4 drop-shadow-cyan" />
                <span className="text-lg font-medium text-white tracking-tight">Enterprise Security</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right Side - Sign In */}
      <div className="flex-1 flex flex-col items-start justify-center pl-6"> {/* Reduced pl-16 to pl-6 */}
        <Card className="w-full max-w-lg mx-auto shadow-2xl border border-gray-900 bg-[#111] min-h-[480px] flex flex-col justify-center"> {/* Added min-h-[480px] and flex utilities */}
          <CardHeader className="text-center space-y-5 pb-8 pt-12">
            <div className="mx-auto w-16 h-16 bg-cyan-900 rounded-2xl flex items-center justify-center">
              <Shield className="h-8 w-8 text-cyan-400" />
            </div>
            <div>
              <CardTitle className="text-2xl font-bold text-white tracking-tight">Analytics Automated.</CardTitle>
              <CardDescription className="text-gray-400 mt-2 text-lg">
                Sign in with your Microsoft account
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-8 pb-12 flex-1 flex flex-col justify-center">
            <Button
              onClick={onLogin}
              disabled={isLoggingIn || inProgress === "login"}
              className="w-full h-14 bg-cyan-500 hover:bg-cyan-600 text-white font-semibold text-lg shadow-lg hover:shadow-xl transition-all duration-200 border-0 rounded-xl"
              size="lg"
            >
              {isLoggingIn || inProgress === "login" ? (
                <>
                  <Loader2 className="h-6 w-6 mr-3 animate-spin" />
                  Signing in...
                </>
              ) : (
                <>
                  <Shield className="h-6 w-6 mr-3 text-cyan-100" />
                  Continue with Microsoft
                  <ArrowRight className="h-5 w-5 ml-2 text-cyan-100" />
                </>
              )}
            </Button>

            <div className="text-center">
              <p className="text-sm text-gray-500">
                Secure authentication powered by <span className="font-medium text-cyan-300">Microsoft Graph API</span>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
