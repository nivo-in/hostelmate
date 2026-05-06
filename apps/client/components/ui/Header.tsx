interface HeaderProps {
  title: string
  onSignOut: () => void
}

export function Header({ title, onSignOut }: HeaderProps) {
  return (
    <header className="flex justify-between items-center mb-10">
      <div>
        <p className="text-xs uppercase text-gray-400 tracking-widest">by Nivo</p>
        <h1 className="text-2xl font-medium text-gray-900">{title}</h1>
      </div>
      <button 
        onClick={onSignOut}
        className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
      >
        Sign out
      </button>
    </header>
  )
}
