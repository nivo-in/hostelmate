import Link from 'next/link'

interface CardProps {
  emoji: string
  title: string
  description: string
  href: string
}

export function Card({ emoji, title, description, href }: CardProps) {
  return (
    <Link href={href} className="border border-gray-100 rounded-xl p-6 hover:border-gray-300 transition-colors block bg-white">
      <div className="text-2xl mb-2">{emoji}</div>
      <h3 className="text-sm font-medium text-gray-900">{title}</h3>
      <p className="text-xs text-gray-400 mt-1">{description}</p>
    </Link>
  )
}
