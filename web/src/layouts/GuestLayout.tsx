import { Navigate, Outlet } from 'react-router-dom'
import { useAuthStore } from '../stores/auth'

export function GuestLayout() {
  
  const {token} = useAuthStore();

  if(token) {
    return <Navigate to="/" replace />
  }

  return (
    <Outlet />  
  )
}
