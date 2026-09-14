import * as React from "react"

export interface AnthropicLogoProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  className?: string
}

export const AnthropicLogo: React.FC<AnthropicLogoProps> = ({ className = "w-4 h-4", ...props }) => {
  return (
    <img
      src="/logo.png"
      alt="entri logo"
      className={`object-contain filter grayscale contrast-200 ${className}`}
      {...props}
    />
  )
}
