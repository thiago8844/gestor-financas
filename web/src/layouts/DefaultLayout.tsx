import React from 'react'
import { useAuthStore } from '../stores/auth'
import { Navigate, Outlet } from 'react-router-dom';

export function DefaultLayout() {

  const {token } = useAuthStore();

  if(!token) {
    return <Navigate to="/login" replace />
  }

  return (
    <Outlet />
  )
}
