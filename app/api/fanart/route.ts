import { NextResponse } from 'next/server';
import { Resend } from 'resend';
import { createServiceRoleClient } from '@/lib/supabase-admin';

export async function POST(req: Request) {
  try {
    const resendApiKey = process.env.RESEND_API_KEY;
    const resend = resendApiKey ? new Resend(resendApiKey) : null;
    const admin = createServiceRoleClient();
    const formData = await req.formData();
    
    // Extracción de datos del formulario
    const nombre = formData.get('nombre') as string;
    const apellidos = formData.get('apellidos') as string;
    const nombreArtistico = formData.get('nombreArtistico') as string;
    const email = formData.get('email') as string;
    const comentarios = formData.get('comentarios') as string;
    const instagram = formData.get('instagram') as string;
    const tiktok = formData.get('tiktok') as string;
    const youtube = formData.get('youtube') as string;
    const x = formData.get('x') as string;
    const facebook = formData.get('facebook') as string;
    const userId = (formData.get('userId') as string) || null;

    const files = formData.getAll('files') as File[];
    const uploadedUrls: string[] = [];

    const attachments = await Promise.all(
      files.map(async (file) => {
        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);
        const safeExt = (file.name.split('.').pop() || "bin").replace(/[^a-zA-Z0-9]/g, "");
        const safeName = `${Date.now()}_${Math.random().toString(36).slice(2, 10)}.${safeExt}`;
        const path = `solicitudes/${safeName}`;
        const { error: uploadErr } = await admin.storage
          .from('fanart-pics')
          .upload(path, buffer, {
            contentType: file.type || undefined,
            upsert: false,
          });
        if (!uploadErr) {
          const { data } = admin.storage.from('fanart-pics').getPublicUrl(path);
          if (data?.publicUrl) uploadedUrls.push(data.publicUrl);
        }
        return {
          filename: file.name,
          content: buffer,
        };
      })
    );

   // Construcción del email (Estilizado con tus colores corporativos)
    const htmlContent = `
      <div style="font-family: sans-serif; color: #2F2740; background-color: #FFF9FB; padding: 20px; border-radius: 20px;">
        <h2 style="color: #8C659C; border-bottom: 2px solid #F3C7DA; padding-bottom: 10px;">🎨 Nueva solicitud de Artista: ${nombreArtistico}</h2>
        <p><strong>Nombre real:</strong> ${nombre} ${apellidos}</p>
        <p><strong>Email de contacto:</strong> ${email}</p>
        
        <div style="background-color: #ffffff; padding: 15px; border-radius: 12px; border: 1px solid #F3C7DA; margin: 20px 0;">
          <h3 style="color: #8C659C; margin-top: 0;">Mensaje del artista:</h3>
          <p style="color: #4A3F54; line-height: 1.6;">
            ${comentarios ? comentarios.replace(/\n/g, '<br/>') : '<em>No ha dejado ningún comentario adicional.</em>'}
          </p>
        </div>
        
        <h3 style="color: #8C659C;">Redes Sociales:</h3>
        <ul style="list-style: none; padding: 0;">
          <li style="margin-bottom: 5px;"><strong>Instagram:</strong> ${instagram || 'No indicado'}</li>
          <li style="margin-bottom: 5px;"><strong>TikTok:</strong> ${tiktok || 'No indicado'}</li>
          <li style="margin-bottom: 5px;"><strong>X (Twitter):</strong> ${x || 'No indicado'}</li>
          <li style="margin-bottom: 5px;"><strong>YouTube:</strong> ${youtube || 'No indicado'}</li>
          <li style="margin-bottom: 5px;"><strong>Facebook:</strong> ${facebook || 'No indicado'}</li>
        </ul>
        <p style="font-size: 12px; color: #b17eac; margin-top: 30px; border-top: 1px dashed #F3C7DA; paddingTop: 10px;">
          <em>Aviso: Las muestras de arte originales se encuentran adjuntas y registradas en el Panel Admin.</em>
        </p>
      </div>
    `;

    const comentariosConUrls = `${comentarios || ""}\n\nURLs del portfolio:\n${uploadedUrls.join('\n')}`.trim();
    const { error: insertError } = await admin.from('solicitudes_artistas').insert({
      user_id: userId,
      nombre: `${nombre} ${apellidos}`.trim(),
      email,
      redes: `Instagram: ${instagram || '-'} | TikTok: ${tiktok || '-'} | YouTube: ${youtube || '-'} | X: ${x || '-'} | Facebook: ${facebook || '-'}`,
      comentarios: `[Nombre Artístico: ${nombreArtistico}]\n\n${comentariosConUrls}`,
    });

    if (insertError) {
      console.error("Error guardando solicitud de artista:", insertError);
      return NextResponse.json({ error: insertError.message }, { status: 400 });
    }

    let emailWarning: string | null = null;
    if (resend) {
      const { error } = await resend.emails.send({
        from: 'MyKpopBinder <info@mykpopbinder.com>',
        to: ['info@mykpopbinder.com'],
        subject: `🎨 Nueva solicitud de Artista: ${nombreArtistico}`,
        html: htmlContent,
        attachments: attachments,
      });
      if (error) {
        console.error("Error de Resend:", error);
        emailWarning = error.message;
      }
    } else {
      emailWarning = "RESEND_API_KEY no configurada";
    }

    return NextResponse.json({ success: true, emailWarning, uploadedCount: uploadedUrls.length });

  } catch (error) {
    console.error("Error procesando el formulario:", error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}