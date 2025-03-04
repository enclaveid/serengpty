import { NextRequest, NextResponse } from 'next/server';
import * as bcrypt from 'bcrypt';
import prisma from '../../../services/db/prisma';
import { azureContainerClient } from '../../../services/azure/storage';
import path from 'path';
import fs from 'fs';
import { getUniqueUsername } from '../../../actions/getUniqueUsername';

/**
 * Anonymous user signup API endpoint
 * Accepts conversation data and password, creates a user account
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const password = formData.get('password') as string;
    const conversationsJson = formData.get('conversations') as string;

    if (!password || !conversationsJson) {
      return NextResponse.json(
        { error: 'Password and conversations data are required' },
        { status: 400 }
      );
    }

    // Hash the password
    const passwordHash = await bcrypt.hash(password, 10);

    // Generate a unique name using the existing function
    const name = await getUniqueUsername();

    // Create anonymous user with password hash and generated name
    const user = await prisma.user.create({
      data: {
        passwordHash,
        name,
      },
    });

    // Save the conversations.json file to Azure storage or local filesystem
    // depending on the environment
    const isProduction = process.env.NODE_ENV === 'production';

    if (isProduction) {
      // Save to Azure Blob Storage
      // Create a blob name with user id and path that matches the expected structure
      // The path should match what's expected by the parsed_conversations asset
      const blobName = `api/${user.id}/openai/latest.json`;

      // Upload the conversations JSON as a blob
      const blockBlobClient = azureContainerClient.getBlockBlobClient(blobName);
      await blockBlobClient.upload(conversationsJson, conversationsJson.length);
    } else {
      // In development, save to local filesystem
      // Create local directory structure that matches the expected structure
      const localDataDir = path.join(process.cwd(), 'apps/data-pipeline/data');
      const userDir = path.join(
        localDataDir,
        'api',
        user.id.toString(),
        'openai'
      );

      // Create directory if it doesn't exist
      await fs.promises.mkdir(userDir, { recursive: true });

      // Write the conversations JSON to file
      await fs.promises.writeFile(
        path.join(userDir, 'latest.json'),
        conversationsJson
      );
    }

    return NextResponse.json({
      success: true,
      message: 'User created successfully',
      userId: user.id,
    });
  } catch (error) {
    console.error('Signup error:', error);
    return NextResponse.json(
      { error: 'Failed to create user account' },
      { status: 500 }
    );
  }
}