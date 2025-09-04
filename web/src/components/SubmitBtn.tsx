

export function SubmitBtn({children, loading}: {children: React.ReactNode, loading: boolean}) {
  return (
    <button type="submit" className='btn btn-primary w-100' disabled={loading}>
      {loading ? (
        <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
      ) : (
        children
      )}
    </button>
  )
}
