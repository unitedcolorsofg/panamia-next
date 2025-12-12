'use client';

import { useState } from 'react';
import ExcelJS from 'exceljs';
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

  const handleConvert = async () => {
    if (file) {
      const arrayBuffer = await file.arrayBuffer();
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(arrayBuffer);

      const worksheet = workbook.worksheets[0];
      if (!worksheet) {
        console.error('No worksheets found in workbook');
        return;
      }

      // Convert worksheet to JSON (similar to XLSX.utils.sheet_to_json)
      const json: any[] = [];
      const headers: any[] = [];

      worksheet.getRow(1).eachCell((cell: any, colNumber: number) => {
        headers[colNumber] = cell.value;
      });

      worksheet.eachRow((row: any, rowNumber: number) => {
        if (rowNumber === 1) return; // Skip header row
        const rowData: any = {};
        row.eachCell((cell: any, colNumber: number) => {
          rowData[headers[colNumber]] = cell.value;
        });
        json.push(rowData);
      });

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
    }
  };

  return (
    <div className="container mx-auto max-w-4xl px-4 py-8">
      <div>
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
                <div className="bg-muted rounded-lg p-4">
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
