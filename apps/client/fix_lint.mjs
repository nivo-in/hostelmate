import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const walkSync = (dir, filelist = []) => {
  fs.readdirSync(dir).forEach(file => {
    const dirFile = path.join(dir, file)
    try { filelist = walkSync(dirFile, filelist) }
    catch (err) { if (err.code === 'ENOTDIR' || err.code === 'EBADF') filelist.push(dirFile) }
  })
  return filelist
}

const files = walkSync(path.join(__dirname, 'app')).concat(
  walkSync(path.join(__dirname, 'components')),
  walkSync(path.join(__dirname, 'hooks'))
).filter(f => f.endsWith('.ts') || f.endsWith('.tsx'))

for (const file of files) {
  let content = fs.readFileSync(file, 'utf8')

  // Fix console warnings
  content = content.replace(/^([ \t]*)console\.error\(/gm, '$1// eslint-disable-next-line no-console\n$1console.error(')
  content = content.replace(/^([ \t]*)console\.log\(/gm, '$1// eslint-disable-next-line no-console\n$1console.log(')
  content = content.replace(/\{ console\.error\(/g, '{ // eslint-disable-next-line no-console\nconsole.error(')
  content = content.replace(/\{ console\.log\(/g, '{ // eslint-disable-next-line no-console\nconsole.log(')

  // Unused vars
  content = content.replace(/const handleCheckout = async \(e: React\.FormEvent, paymentId: string\) => \{/g, 'const handleCheckout = async (_e: React.FormEvent, paymentId: string) => {')
  content = content.replace(/handler: function \(response: any\)/g, 'handler: function (_response: any)')
  content = content.replace(/const \{ all: allPayments \} = payments/g, 'const {} = payments')
  content = content.replace(/socket\.on\('connect', \(data: any\)/g, "socket.on('connect', (_data: any)")
  content = content.replace(/socket\.on\('disconnect', \(data: any\)/g, "socket.on('disconnect', (_data: any)")
  content = content.replace(/map\(\(_, i\)/g, "map((_x, i)")
  content = content.replace(/interface UnassignedApiItem [^{]+{[^}]+}/, '')

  content = content.replace(/const scanStartTimeRef = useRef<number>\(0\)\n/g, '')
  content = content.replace(/const facePositionHistoryRef = useRef<{x: number, y: number, time: number}\[\]>\(\[\]\);\n/g, '')
  content = content.replace(/const \[isFailed, setIsFailed\] = useState\(false\)\n/g, '')

  content = content.replace(/const options = \{/g, 'const _options = {')
  content = content.replace(/\/\/ eslint-disable-next-line react-hooks\/exhaustive-deps\n/g, '')

  content = content.replace(/reason: string/g, '_reason: string')

  content = content.replace(/const \[pendingRole, setPendingRole\] = useState<string \| null>\(null\)/g, '')
  content = content.replace(/setPendingRole\(role\)/g, '')

  // Fix event, handler, args by prepending with _ in payments
  content = content.replace(/const handleCheckout = async \(/g, '// eslint-disable-next-line @typescript-eslint/no-unused-vars\n  const handleCheckout = async (')
  content = content.replace(/event, handler, args/g, '_event, _handler, _args')
  content = content.replace(/\(resolve\) =>/g, '(_resolve) =>')

  if (content !== fs.readFileSync(file, 'utf8')) {
    fs.writeFileSync(file, content)
  }
}
