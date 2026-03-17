"use client"

import { useState, useMemo } from "react"
import { useMsal, useAccount } from "@azure/msal-react"
import { loginRequest } from "@/msalConfig"

export function useAuth() {
  const { instance, accounts, inProgress } = useMsal()
  const account = useAccount(accounts[0] || null)
  const [isLoggingIn, setIsLoggingIn] = useState(false)

  // User object for your app
  const user = useMemo(() => {
    if (!account) return null
    return {
      name: account.name,
      email: account.username,
      avatar: "/placeholder.svg?height=32&width=32", // You can fetch a real avatar from Graph if needed
    }
  }, [account])

  const isAuthenticated = !!account

  const handleMicrosoftLogin = async () => {
    setIsLoggingIn(true)
    try {
      // Use loginRedirect for more reliable state update in Next.js apps
      await instance.loginRedirect(loginRequest)
    } finally {
      setIsLoggingIn(false)
    }
  }

  const handleLogout = () => {
    instance.logoutPopup()
  }

  return {
    user,
    isAuthenticated,
    isLoggingIn: isLoggingIn || inProgress === "login",
    handleMicrosoftLogin,
    handleLogout,
  }
}
