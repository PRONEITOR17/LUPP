// Datos con los que arranca LUPP la primera vez (pensados para Colombia).
// Todo se puede editar o borrar después desde Ajustes.

export const COLORES = [
  '#D4AF37', '#C2410C', '#3B82F6', '#10B981', '#8B5CF6',
  '#EC4899', '#14B8A6', '#F59E0B', '#EF4444', '#64748B',
];

export const ICONOS_CATEGORIA = [
  'tools-kitchen-2', 'shopping-cart', 'basket', 'bus', 'moped', 'car', 'gas-station',
  'home', 'bolt', 'droplet', 'flame', 'wifi', 'device-mobile', 'first-aid-kit', 'pill',
  'school', 'shirt', 'device-tv', 'beer', 'gift', 'plane', 'paw', 'barbell',
  'briefcase', 'cash', 'coin', 'pig-money', 'building-store', 'truck', 'users',
  'receipt', 'receipt-tax', 'speakerphone', 'tool', 'dots',
];

export const ICONOS_CUENTA = [
  'cash', 'wallet', 'device-mobile', 'building-bank', 'credit-card', 'pig-money', 'coin', 'briefcase',
];

export const CUENTAS_BASE = {
  personal: [
    { nombre: 'Efectivo', icono: 'cash' },
    { nombre: 'Nequi', icono: 'device-mobile' },
    { nombre: 'Daviplata', icono: 'device-mobile' },
    { nombre: 'Bancolombia', icono: 'building-bank' },
    { nombre: 'Tarjeta de crédito', icono: 'credit-card' },
  ],
  empresa: [
    { nombre: 'Caja', icono: 'cash' },
    { nombre: 'Banco empresa', icono: 'building-bank' },
  ],
};

export const CATEGORIAS_BASE = {
  personal: [
    { nombre: 'Comida', tipo: 'gasto', icono: 'tools-kitchen-2', color: '#F59E0B' },
    { nombre: 'Mercado', tipo: 'gasto', icono: 'shopping-cart', color: '#10B981' },
    { nombre: 'Transporte', tipo: 'gasto', icono: 'bus', color: '#3B82F6' },
    { nombre: 'Arriendo', tipo: 'gasto', icono: 'home', color: '#8B5CF6' },
    { nombre: 'Servicios', tipo: 'gasto', icono: 'bolt', color: '#D4AF37' },
    { nombre: 'Internet y celular', tipo: 'gasto', icono: 'wifi', color: '#14B8A6' },
    { nombre: 'Salud', tipo: 'gasto', icono: 'first-aid-kit', color: '#EF4444' },
    { nombre: 'Educación', tipo: 'gasto', icono: 'school', color: '#6366F1' },
    { nombre: 'Ropa', tipo: 'gasto', icono: 'shirt', color: '#EC4899' },
    { nombre: 'Salidas y ocio', tipo: 'gasto', icono: 'beer', color: '#C2410C' },
    { nombre: 'Regalos', tipo: 'gasto', icono: 'gift', color: '#DB2777' },
    { nombre: 'Otros gastos', tipo: 'gasto', icono: 'dots', color: '#64748B' },
    { nombre: 'Sueldo', tipo: 'ingreso', icono: 'briefcase', color: '#10B981' },
    { nombre: 'Ventas', tipo: 'ingreso', icono: 'cash', color: '#D4AF37' },
    { nombre: 'Trabajos extra', tipo: 'ingreso', icono: 'coin', color: '#14B8A6' },
    { nombre: 'Otros ingresos', tipo: 'ingreso', icono: 'dots', color: '#64748B' },
  ],
  empresa: [
    { nombre: 'Proveedores', tipo: 'gasto', icono: 'truck', color: '#3B82F6' },
    { nombre: 'Nómina', tipo: 'gasto', icono: 'users', color: '#8B5CF6' },
    { nombre: 'Arriendo local', tipo: 'gasto', icono: 'building-store', color: '#C2410C' },
    { nombre: 'Servicios', tipo: 'gasto', icono: 'bolt', color: '#D4AF37' },
    { nombre: 'Impuestos DIAN', tipo: 'gasto', icono: 'receipt-tax', color: '#EF4444' },
    { nombre: 'Publicidad', tipo: 'gasto', icono: 'speakerphone', color: '#EC4899' },
    { nombre: 'Otros gastos', tipo: 'gasto', icono: 'dots', color: '#64748B' },
    { nombre: 'Ventas', tipo: 'ingreso', icono: 'cash', color: '#10B981' },
    { nombre: 'Servicios prestados', tipo: 'ingreso', icono: 'briefcase', color: '#D4AF37' },
    { nombre: 'Otros ingresos', tipo: 'ingreso', icono: 'dots', color: '#64748B' },
  ],
};
