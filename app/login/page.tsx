import LoginForm from './login-form'

export const dynamic = 'force-dynamic'

export default function LoginPage() {
  return (
    <LoginForm
      supabaseUrl={process.env.SUPABASE_URL!}
      supabaseKey={process.env.SUPABASE_ANON_KEY!}
    />
  )
}
