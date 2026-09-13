import * as React from "react"

export interface AnthropicLogoProps extends React.SVGProps<SVGSVGElement> {
  className?: string
}

export const AnthropicLogo: React.FC<AnthropicLogoProps> = ({ className = "w-4 h-4", ...props }) => {
  return (
    <svg
      role="img"
      viewBox="0 0 24 24"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      {...props}
    >
      <title>Anthropic</title>
      <path d="M17.3041 3.541h-3.6718l6.696 16.918H24Zm-10.6082 0L0 20.459h3.7442l1.3693-3.5527h7.0052l1.3693 3.5528h3.7442L10.5363 3.541Z" />
    </svg>
  )
}
