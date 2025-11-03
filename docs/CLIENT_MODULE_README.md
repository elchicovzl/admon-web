# Módulo de Gestión de Clientes

Sistema completo de gestión de clientes con CRUD, sistema de notas y gestión de documentos con AWS S3.

## 🎯 Características Implementadas

### ✅ CRUD de Clientes
- **Crear** clientes con información completa
- **Listar** clientes con filtros y estadísticas
- **Ver** detalles completos del cliente
- **Actualizar** información del cliente
- **Desactivar** clientes (soft delete)

### ✅ Sistema de Notas
- Agregar notas múltiples por cliente
- Timeline de notas con información del autor
- Eliminar notas (solo el creador o SUPER_ADMIN)
- Formato de texto con whitespace preservado

### ✅ Gestión de Documentos (AWS S3)
- **Subida** de archivos con drag & drop (react-dropzone)
- **Tipos soportados**: Imágenes (PNG, JPG, JPEG, GIF, WEBP), PDFs, Documentos Word (DOC, DOCX)
- **Límite de tamaño**: 10MB por archivo
- **Almacenamiento**: AWS S3 con presigned URLs
- **Vista previa** y descarga de documentos
- **Eliminación** de documentos (S3 + DB)
- **Progress bar** durante la subida
- **Galería** visual de documentos

## 📊 Modelo de Datos

### Client
```prisma
model Client {
  id                   String             @id @default(cuid())
  fullName             String
  identificationType   IdentificationType  // CEDULA, CEDULA_EXTRANJERIA, PPT, NIT
  identificationNumber String             @unique
  clientType           ClientType          // EMPLEADO, EMPRESA, INDEPENDIENTE
  email                String
  phone                String
  status               String             @default("ACTIVO")
  isActive             Boolean            @default(true)
  createdAt            DateTime           @default(now())
  updatedAt            DateTime           @updatedAt
  createdById          String

  // Relations
  notes                ClientNote[]
  documents            ClientDocument[]
}
```

### ClientNote
```prisma
model ClientNote {
  id          String   @id @default(cuid())
  content     String   @db.Text
  clientId    String
  createdById String
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}
```

### ClientDocument
```prisma
model ClientDocument {
  id           String   @id @default(cuid())
  fileName     String
  fileUrl      String
  fileType     String
  fileSize     Int
  s3Key        String
  clientId     String
  uploadedById String
  createdAt    DateTime @default(now())
}
```

## 🚀 Configuración

### 1. Variables de Entorno

Agrega las siguientes variables a tu archivo `.env`:

```bash
# AWS S3 Configuration
AWS_REGION="us-east-1"
AWS_S3_BUCKET="your-bucket-name"
AWS_ACCESS_KEY_ID="your-access-key-id"
AWS_SECRET_ACCESS_KEY="your-secret-access-key"
```

### 2. Configurar AWS S3 Bucket

#### Crear Bucket
1. Ve a AWS S3 Console
2. Crea un nuevo bucket (ej: `admon-client-documents`)
3. Región: Selecciona la misma que configuraste en `AWS_REGION`
4. **Block Public Access**: Mantén habilitado (los archivos se acceden via presigned URLs)

#### Configurar CORS
Agrega la siguiente política CORS a tu bucket:

```json
[
  {
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["GET", "PUT", "POST", "DELETE"],
    "AllowedOrigins": ["http://localhost:3000", "https://tu-dominio.com"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3000
  }
]
```

#### IAM Policy
Crea un usuario IAM con la siguiente política:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:GetObject",
        "s3:DeleteObject"
      ],
      "Resource": "arn:aws:s3:::your-bucket-name/*"
    }
  ]
}
```

### 3. Ejecutar Migraciones

La migración ya fue ejecutada, pero si necesitas ejecutarla nuevamente:

```bash
pnpm db:migrate
```

## 📁 Estructura de Archivos

```
├── prisma/
│   └── schema.prisma                          # Modelos Client, ClientNote, ClientDocument
├── lib/
│   ├── types/
│   │   └── client.types.ts                    # Tipos TypeScript
│   ├── validations/
│   │   └── client.schema.ts                   # Schemas Zod
│   └── actions/
│       ├── client.actions.ts                  # CRUD y notas
│       └── document.actions.ts                # Gestión de documentos S3
├── components/dashboard/clients/
│   ├── clients-table.tsx                      # Tabla de clientes
│   ├── clients-table-skeleton.tsx             # Loading state
│   ├── client-form-dialog.tsx                 # Form crear/editar
│   ├── client-notes-section.tsx               # Sistema de notas
│   └── client-documents-gallery.tsx           # Galería de documentos
└── app/dashboard/clients/
    ├── page.tsx                               # Lista de clientes
    └── [id]/
        └── page.tsx                           # Detalle del cliente
```

## 🔐 RBAC (Control de Acceso)

### Acceso al Módulo
- ✅ **SUPER_ADMIN**: Acceso completo
- ✅ **MANAGER**: Acceso completo
- ❌ **Otros**: Sin acceso

### Permisos Específicos
- **Crear cliente**: SUPER_ADMIN, MANAGER
- **Editar cliente**: SUPER_ADMIN, MANAGER
- **Desactivar cliente**: SUPER_ADMIN, MANAGER
- **Agregar nota**: SUPER_ADMIN, MANAGER
- **Eliminar nota**: Creador de la nota o SUPER_ADMIN
- **Subir documento**: SUPER_ADMIN, MANAGER
- **Eliminar documento**: SUPER_ADMIN, MANAGER

## 🎨 Componentes Clave

### ClientsTable
Tabla responsive con:
- Información del cliente (nombre, identificación, tipo, contacto)
- Badges de status (Activo/Inactivo)
- Acciones: Ver detalle, Editar, Activar/Desactivar

### ClientFormDialog
Formulario modal para crear/editar:
- Validación con React Hook Form + Zod
- Campos: nombre, tipo identificación, número, tipo cliente, email, teléfono, status
- Modo crear y editar con el mismo componente

### ClientNotesSection
Sistema de notas con:
- Formulario de agregación con Textarea
- Timeline de notas con avatar del autor
- Fecha y hora de creación
- Botón de eliminación (condicional por permisos)

### ClientDocumentsGallery
Gestión de documentos con:
- **Drag & Drop** con react-dropzone
- Validación de tipos y tamaño
- **Progress bar** durante subida
- Grid de documentos con:
  - Iconos por tipo de archivo
  - Badge de tipo (Imagen, PDF, Documento)
  - Información del uploader y fecha
  - Botones: Ver, Descargar, Eliminar

## 🔄 Flujo de Subida de Documentos

1. **Usuario** arrastra o selecciona archivo(s)
2. **Cliente** valida tipo y tamaño (máx. 10MB)
3. **Server Action** genera presigned URL de S3 (válida 5 min)
4. **Cliente** sube directamente a S3 via presigned URL
5. **Server Action** confirma subida y guarda metadata en DB
6. **UI** actualiza galería con nuevo documento

### Ventajas de Presigned URLs
- ✅ No pasa por el servidor Next.js (mejor performance)
- ✅ Seguro (URL temporal con expiración)
- ✅ No expone credenciales AWS
- ✅ Escalable (subidas directas a S3)

## 📊 Server Actions

### Client Actions (`lib/actions/client.actions.ts`)
```typescript
getClients()                          // Listar todos los clientes
getClientById(id)                     // Obtener cliente con relaciones
createClient(data)                    // Crear nuevo cliente
updateClient(id, data)                // Actualizar cliente
toggleClientStatus(id, isActive)      // Activar/desactivar
addClientNote(clientId, content)      // Agregar nota
deleteClientNote(noteId)              // Eliminar nota
getClientsCount()                     // Estadísticas
```

### Document Actions (`lib/actions/document.actions.ts`)
```typescript
generateUploadUrl(clientId, fileName, fileType, fileSize)  // Presigned URL
confirmUpload(clientId, fileName, fileType, fileSize, s3Key)  // Guardar metadata
deleteDocument(documentId)            // Eliminar de S3 y DB
getClientDocuments(clientId)          // Listar documentos
```

## 🧪 Testing Manual

### 1. Crear Cliente
```
1. Ir a /dashboard/clients
2. Click "Crear Cliente"
3. Llenar formulario
4. Submit → Cliente aparece en tabla
```

### 2. Ver Detalle
```
1. Click en "Ver Detalles" en tabla
2. Verifica información personal y contacto
3. Verifica secciones de notas y documentos
```

### 3. Agregar Nota
```
1. En detalle del cliente
2. Escribir en textarea
3. Click "Agregar Nota"
4. Nota aparece en timeline
```

### 4. Subir Documento
```
1. En detalle del cliente, sección documentos
2. Arrastrar archivo o click para seleccionar
3. Ver progress bar
4. Documento aparece en galería
5. Probar "Ver" y "Descargar"
```

### 5. Eliminar Documento
```
1. Hover sobre documento
2. Click X
3. Confirmar en dialog
4. Documento desaparece (S3 + DB)
```

## 🐛 Troubleshooting

### Error: "AWS credentials not configured"
**Solución**: Verifica que todas las variables AWS_* estén en `.env`

### Error al subir a S3
**Solución**:
- Verifica política CORS del bucket
- Verifica permisos IAM del usuario
- Verifica que el bucket esté en la región correcta

### Documentos no se muestran
**Solución**:
- Verifica que el bucket sea privado pero accesible via presigned URLs
- Verifica que la URL generada sea correcta (formato: `https://bucket.s3.region.amazonaws.com/key`)

### Error de CORS en upload
**Solución**: Agrega tu dominio a `AllowedOrigins` en la política CORS del bucket

## 📈 Próximas Mejoras

- [ ] Búsqueda y filtros avanzados en tabla de clientes
- [ ] Paginación en tabla
- [ ] Exportar lista de clientes a CSV/Excel
- [ ] Vista previa de imágenes en modal
- [ ] Vista previa de PDFs en modal (PDF.js)
- [ ] Compartir documentos via link temporal
- [ ] Editar notas existentes
- [ ] Versioning de documentos
- [ ] Audit log de cambios en cliente

## 📚 Recursos

- [AWS S3 Docs](https://docs.aws.amazon.com/s3/)
- [Presigned URLs Guide](https://docs.aws.amazon.com/AmazonS3/latest/userguide/PresignedUrlUploadObject.html)
- [react-dropzone Docs](https://react-dropzone.js.org/)
- [Next.js Server Actions](https://nextjs.org/docs/app/building-your-application/data-fetching/server-actions-and-mutations)

---

**Implementado**: 2025-11-02
**Stack**: Next.js 15 + AWS S3 + react-dropzone + Prisma + PostgreSQL
