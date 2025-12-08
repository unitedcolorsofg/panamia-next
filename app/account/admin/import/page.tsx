'use client';

import { useState } from 'react';
import * as XLSX from 'xlsx';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Upload, FileSpreadsheet } from 'lucide-react';

export default function ExcelImportPage() {
  const [file, setFile] = useState<File | null>(null);
  const [importConfirmation, setImportConfirmation] = useState(false);
  const [jsonData, setJsonData] = useState('');

  async function importUsers() {
    const res = await axios
      .post(
        '/api/importProfiles',
        { jsonData },
        {
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
          },
        }
      )
      .then(async (response) => {
        if (response.data.error) {
          alert(response.data.error);
        } else {
          setImportConfirmation(true);
          alert('Profiles have been imported!');
        }
      })
      .catch((error) => {
        console.log(error);
        alert('There was a problem uploading these users: ' + error.message);
      });
    console.log(res);
  }

  const handleConvert = () => {
    if (file) {
      const reader = new FileReader();
      reader.onload = (e: any) => {
        const data = e.target.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        if (!sheetName) {
          console.error('No sheets found in workbook');
          return;
        }
        const worksheet = workbook.Sheets[sheetName];
        if (!worksheet) {
          console.error('Sheet not found');
          return;
        }
        const json = XLSX.utils.sheet_to_json(worksheet);
        setJsonData(JSON.stringify(json, null, 2));
        console.log(json);

        let newJsonArray = [{}];
        json.forEach((item: any) => {
          const socials = {
            website: item.website,
            facebook: item.facebook,
            instagram: item.instagram,
            tiktok: item.tiktok,
            twitter: item.twitter,
            spotify: item.spotify,
          };

          const newItem = {
            background: item.background,
            details: item.details,
            email: item.email,
            five_words: item.five_words,
            name: item.name,
            tags: item.tags,
            slug: item.name.toString().toLowerCase().replace(' ', '_'),
            phone_number: item.phone_number,
            createdAt: new Date(item.date_added.toString()),
          };

          newJsonArray.push(newItem);
        });

        console.log('new formatted Json array');
        console.log(newJsonArray);
      };
      reader.readAsBinaryString(file);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8 dark:bg-gray-900">
      <div className="mx-auto max-w-4xl px-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileSpreadsheet className="h-6 w-6" />
              Excel Profile Import
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="file-upload" className="text-sm font-medium">
                  Select Excel File (.xls, .xlsx)
                </label>
                <Input
                  id="file-upload"
                  type="file"
                  accept=".xls,.xlsx"
                  onChange={(e: any) => setFile(e.target.files[0])}
                />
              </div>
              <Button onClick={handleConvert} disabled={!file}>
                <Upload className="mr-2 h-4 w-4" />
                Convert to JSON
              </Button>
            </div>

            {jsonData && (
              <div className="space-y-4">
                <div className="rounded-lg bg-muted p-4">
                  <h3 className="mb-2 font-semibold">Preview:</h3>
                  <pre className="max-h-96 overflow-auto text-xs">
                    {jsonData}
                  </pre>
                </div>
                <Button onClick={importUsers} variant="default">
                  Import Profiles
                </Button>
              </div>
            )}

            {importConfirmation && (
              <div className="rounded-lg border border-green-500 bg-green-50 p-4 text-green-900 dark:bg-green-900/20 dark:text-green-100">
                Profiles have been successfully imported!
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
