# Comercial Monte - Reglas del Proyecto

Este archivo contiene las definiciones clave y reglas de negocio para la aplicación de gestión forestal.

## Equipo Cerificado (Roles y Nombres)
Para asegurar que los insumos se entreguen correctamente, el personal debe estar registrado con sus roles específicos:

- **Dueños / Administradores**: Ricardo (mari.ricardo@gmail.com)
- **Jefes de Faena / Supervisión**:
  - Adonis Espinoza (Jefe de Faena)
  - René Villa (Operador de Torre Forestal - Boss role)
- **Personal de Corte (Motosierristas)**:
  - Héctor Muñoz
  - Cristian Monsalves
  - Jaime Cáceres
  - Julio Mulato

## Reglas de Insumos
1. **Control de Entrega**: Cada carga de combustible o aceite DEBE estar vinculada a un receptor (Persona o Máquina).
2. **Ajuste de Stock**: El sistema descuenta automáticamente del inventario central cada vez que se registra un consumo.
3. **Control Horario**: Es obligatorio registrar la hora de cada faena o entrega para trazabilidad.

## Maquinaria y Mantenimiento
- El mantenimiento se calcula cada 30 días o según las horas de trabajo.
- Se debe visualizar un estado de "Semáforo" (Verde/Naranja/Rojo) basado en la proximidad de la fecha técnica.

## Operación en Terreno
- La aplicación es **Mobile-First**.
- Debe soportar **Modo Offline** (Firestore Persistence) ya que en los cerros la señal es inestable.
- Se permite la georeferenciación del punto de cosecha.
