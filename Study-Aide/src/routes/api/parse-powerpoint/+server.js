import { json } from '@sveltejs/kit';
import { OPENAI_API_KEY } from '$env/static/private';
import { writeFile, unlink } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { exec } from 'child_process';
import { promisify } from 'util';
import { fileTypeFromBuffer } from 'file-type';

const execAsync = promisify(exec);

export async function POST({ request }) {
  try {
    const formData = await request.formData();
    const file = formData.get('file');

    if (!file) {
      return json({ success: false, error: 'No file provided' }, { status: 400 });
    }

    // Validate file type
    const buffer = await file.arrayBuffer();
    const fileType = await fileTypeFromBuffer(Buffer.from(buffer));
    
    if (!fileType || !['application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation'].includes(fileType.mime)) {
      return json({ success: false, error: 'Invalid file type. Only .ppt and .pptx files are supported.' }, { status: 400 });
    }

    // Create temporary file
    const tempFilePath = join(tmpdir(), `temp-${Date.now()}.${fileType.ext}`);
    await writeFile(tempFilePath, Buffer.from(buffer));

    try {
      // Use python-pptx to extract text with UTF-8 encoding
      const { stdout, stderr } = await execAsync(`python "${join(process.cwd(), 'src/lib/scripts/parse_pptx.py')}" "${tempFilePath}"`, {
        encoding: 'utf8',
        env: { ...process.env, PYTHONIOENCODING: 'utf-8' }
      });

      if (stderr) {
        console.error('Python script error:', stderr);
        throw new Error(stderr);
      }

      return json({ 
        success: true, 
        content: stdout.trim()
      });
    } finally {
      // Clean up temp file
      await unlink(tempFilePath).catch(console.error);
    }

  } catch (error) {
    console.error('PowerPoint parsing error:', error);
    return json({ 
      success: false, 
      error: error.message || 'Failed to parse PowerPoint file'
    }, { status: 500 });
  }
} 