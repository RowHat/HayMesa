// Al cambiar la key React vuelve a montar el span y la animación arranca de nuevo
export default function NumeroAnimado({ valor, className = '' }: { valor: number; className?: string }) {
  return (
    <span key={valor} className={`inline-block animate-cambio ${className}`}>
      {valor}
    </span>
  )
}
