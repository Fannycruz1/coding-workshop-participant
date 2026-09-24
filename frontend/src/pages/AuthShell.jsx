/** The frame around the sign-in and register forms. */
export default function AuthShell({ title, children }) {
  return (
    <main className="auth">
      <div className="auth-panel">
        <div className="brand static">
          <span className="brand-mark">A</span>
          <span><strong>ACME</strong><small>Facility Incident Management</small></span>
        </div>
        <h1>{title}</h1>
        {children}
      </div>
    </main>
  )
}
