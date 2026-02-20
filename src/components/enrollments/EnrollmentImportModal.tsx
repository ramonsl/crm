'use client';

import { useState, useRef, useCallback } from 'react';
import { X, Upload, FileSpreadsheet, CheckCircle } from 'lucide-react';
import styles from './EnrollmentImportModal.module.css';
import { Semester, ImportResult } from '@/types/enrollment';

interface EnrollmentImportModalProps {
    semesters: Semester[];
    selectedSemesterId: number | null;
    onClose: () => void;
    onImportComplete: () => void;
}

export default function EnrollmentImportModal({
    semesters,
    selectedSemesterId,
    onClose,
    onImportComplete,
}: EnrollmentImportModalProps) {
    const [semesterId, setSemesterId] = useState<number>(selectedSemesterId ?? semesters[0]?.id ?? 0);
    const [file, setFile] = useState<File | null>(null);
    const [importing, setImporting] = useState(false);
    const [result, setResult] = useState<ImportResult | null>(null);
    const [isDragOver, setIsDragOver] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileSelect = useCallback((selectedFile: File) => {
        const name = selectedFile.name.toLowerCase();
        if (name.endsWith('.xls') || name.endsWith('.xlsx')) {
            setFile(selectedFile);
            setResult(null);
        }
    }, []);

    const handleDrop = useCallback(
        (e: React.DragEvent) => {
            e.preventDefault();
            setIsDragOver(false);
            const droppedFile = e.dataTransfer.files[0];
            if (droppedFile) handleFileSelect(droppedFile);
        },
        [handleFileSelect]
    );

    const handleImport = async () => {
        if (!file || !semesterId) return;

        setImporting(true);
        setResult(null);

        try {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('semesterId', semesterId.toString());

            const response = await fetch('/api/enrollments/import', {
                method: 'POST',
                body: formData,
            });

            const data: ImportResult = await response.json();
            setResult(data);

            if (data.success) {
                onImportComplete();
            }
        } catch (error) {
            console.error('Erro na importação:', error);
            setResult({
                success: false,
                totalProcessed: 0,
                totalInserted: 0,
                errors: ['Erro de conexão com o servidor'],
            });
        } finally {
            setImporting(false);
        }
    };

    return (
        <div className={styles.overlay} onClick={onClose} role="dialog" aria-modal="true">
            <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
                <div className={styles.header}>
                    <h2 className={styles.title}>Importar Planilha</h2>
                    <button
                        className={styles.closeButton}
                        onClick={onClose}
                        aria-label="Fechar"
                        id="close-import-modal"
                    >
                        <X size={20} />
                    </button>
                </div>

                <div className={styles.body}>
                    <div className={styles.field}>
                        <label className={styles.label} htmlFor="semester-select">
                            Semestre
                        </label>
                        <select
                            id="semester-select"
                            className={styles.select}
                            value={semesterId}
                            onChange={(e) => setSemesterId(Number(e.target.value))}
                        >
                            {semesters.map((s) => (
                                <option key={s.id} value={s.id}>
                                    {s.code}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className={styles.field}>
                        <label className={styles.label}>Arquivo</label>
                        <div
                            className={`${styles.dropZone} ${isDragOver ? styles.dropZoneActive : ''}`}
                            onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
                            onDragLeave={() => setIsDragOver(false)}
                            onDrop={handleDrop}
                            onClick={() => fileInputRef.current?.click()}
                            role="button"
                            tabIndex={0}
                            aria-label="Selecionar arquivo"
                            id="file-drop-zone"
                        >
                            {file ? (
                                <div className={styles.fileName}>
                                    <FileSpreadsheet size={20} />
                                    <span>{file.name}</span>
                                </div>
                            ) : (
                                <>
                                    <Upload size={32} className={styles.dropZoneIcon} />
                                    <div className={styles.dropZoneText}>
                                        Arraste o arquivo aqui ou clique para selecionar
                                    </div>
                                    <div className={styles.dropZoneHint}>
                                        Formatos aceitos: .xls, .xlsx
                                    </div>
                                </>
                            )}
                        </div>
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept=".xls,.xlsx"
                            style={{ display: 'none' }}
                            onChange={(e) => {
                                const selected = e.target.files?.[0];
                                if (selected) handleFileSelect(selected);
                            }}
                            id="file-input"
                        />
                    </div>

                    {result && (
                        <div
                            className={`${styles.result} ${result.success ? styles.resultSuccess : styles.resultError
                                }`}
                            role="status"
                            id="import-result"
                        >
                            {result.success ? (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <CheckCircle size={18} />
                                    <span>
                                        Importação concluída: {result.totalInserted} registros processados
                                    </span>
                                </div>
                            ) : (
                                <>
                                    <div>Erro na importação</div>
                                    {result.errors.length > 0 && (
                                        <ul className={styles.errorList}>
                                            {result.errors.slice(0, 5).map((err, i) => (
                                                <li key={i}>{err}</li>
                                            ))}
                                        </ul>
                                    )}
                                </>
                            )}
                        </div>
                    )}
                </div>

                <div className={styles.footer}>
                    <button
                        className={styles.cancelButton}
                        onClick={onClose}
                        id="cancel-import"
                    >
                        Cancelar
                    </button>
                    <button
                        className={styles.importButton}
                        onClick={handleImport}
                        disabled={!file || !semesterId || importing}
                        id="confirm-import"
                    >
                        {importing ? 'Importando...' : 'Importar'}
                    </button>
                </div>
            </div>
        </div>
    );
}
