"use client"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Cloud, LogOut, Settings, Sparkles, ChevronRight } from "lucide-react"
import type { User, Analytics } from "@/types"

interface HeaderProps {
  user: User
  analytics: Analytics
  pageTitle?: string
  onLogout: () => void
}

export function Header({ user, analytics, pageTitle = "Master Dashboard", onLogout }: HeaderProps) {
  return (
    <header className="border-b border-[#232f47] bg-[#181e29]/90 backdrop-blur-sm sticky top-0 left-0 right-0 z-50 w-full m-0 p-0">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 m-0 p-0">
        <div className="flex justify-between items-center h-16 m-0 p-0">
          <div className="flex items-center space-x-4">
            <div className="flex items-center">
              <div className="flex items-center">
                <span className="text-white font-inter font-medium">Cloud Extel</span>
                <ChevronRight className="h-4 w-4 mx-1 text-gray-400" />
                <span className="text-white font-inter">{pageTitle}</span>
              </div>
            </div>
            <Badge
              variant="secondary"
              className="hidden sm:inline-flex bg-[#232f47]/60 text-white border-[#232f47]/30 font-inter"
            >
              <Sparkles className="h-3 w-3 mr-1" />
              AI-Powered
            </Badge>
          </div>

          <div className="flex items-center space-x-4">
            <div className="hidden md:flex items-center space-x-6 text-sm text-gray-300 font-inter">
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span>{analytics.totalProcessed} Processed</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-[#ee3954] rounded-full"></div>
                <span>{analytics.avgProcessingTime}s Avg</span>
              </div>
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-9 w-9 rounded-full">
                  <Avatar className="h-9 w-9">
                    <AvatarImage src={user.avatar || "/placeholder.svg"} alt={user.name} />
                    <AvatarFallback className="bg-[#232f47] text-white font-inter">
                      {user.name.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56 bg-[#181e29] border-[#232f47]" align="end" forceMount>
                <DropdownMenuLabel className="font-normal font-inter">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium leading-none text-white font-inter">{user.name}</p>
                    <p className="text-xs leading-none text-gray-400 font-inter">{user.email}</p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator className="bg-[#232f47]" />
                <DropdownMenuItem className="text-gray-300 hover:bg-[#232f47] font-inter">
                  <Cloud className="mr-2 h-4 w-4" />
                  Profile
                </DropdownMenuItem>
                <DropdownMenuItem className="text-gray-300 hover:bg-[#232f47] font-inter">
                  <Settings className="mr-2 h-4 w-4" />
                  Settings
                </DropdownMenuItem>
                <DropdownMenuSeparator className="bg-[#232f47]" />
                <DropdownMenuItem onClick={onLogout} className="text-gray-300 hover:bg-[#232f47] font-inter">
                  <LogOut className="mr-2 h-4 w-4" />
                  Log out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
    </header>
  )
}
