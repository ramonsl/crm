import type { Contact } from '@/types/contacts';

interface ContactsDeleteModalProps {
    contact: Contact | null;
    onCancel: () => void;
    onConfirm: () => void;
}

export function ContactsDeleteModal({ contact, onCancel, onConfirm }: ContactsDeleteModalProps) {
    if (!contact) return null;

    return (
        <div style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999
        }}>
            <div style={{
                background: 'linear-gradient(145deg, #1a1a2e 0%, #16213e 100%)',
                borderRadius: '16px',
                padding: '2rem',
                maxWidth: '400px',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
            }}>
                <h3 style={{ color: '#fff', marginBottom: '1rem' }}>Confirmar Exclusão</h3>
                <p style={{ color: '#9ca3af', marginBottom: '1.5rem' }}>
                    Tem certeza que deseja deletar <strong style={{ color: '#fff' }}>{contact.nome}</strong>?
                    <br /><br />
                    Esta ação não pode ser desfeita.
                </p>
                <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
                    <button
                        onClick={onCancel}
                        style={{
                            padding: '0.75rem 1.5rem',
                            borderRadius: '8px',
                            border: '1px solid rgba(255, 255, 255, 0.2)',
                            background: 'transparent',
                            color: '#fff',
                            cursor: 'pointer'
                        }}
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={onConfirm}
                        style={{
                            padding: '0.75rem 1.5rem',
                            borderRadius: '8px',
                            border: 'none',
                            background: '#ef4444',
                            color: '#fff',
                            cursor: 'pointer'
                        }}
                    >
                        Deletar
                    </button>
                </div>
            </div>
        </div>
    );
}
