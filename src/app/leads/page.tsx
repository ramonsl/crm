'use client';

import { useState, useEffect } from 'react';
import styles from '../contacts/page.module.css';
import { RefreshCw, Search, ChevronLeft, ChevronRight, Filter, MessageSquare, X, Send, Edit2, Trash2, Plus, ChevronUp, ChevronDown, Upload } from 'lucide-react';

import MultiSelect from '@/components/MultiSelect';
import TimeAgoBadge from '@/components/TimeAgoBadge';
import WhatsAppIndicator from '@/components/WhatsAppIndicator';
import { useToast } from '@/contexts/ToastContext';

export default function LeadsPage() {
    const { success: toastSuccess, error: toastError, warning: toastWarning } = useToast();
    const [leads, setLeads] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [page, setPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(25);
    const [totalPages, setTotalPages] = useState(1);
    const [search, setSearch] = useState('');
    const [waStatus, setWaStatus] = useState<'disconnected' | 'initializing' | 'ready'>('disconnected');
    const [courseFilter, setCourseFilter] = useState<string[]>([]);
    const [lastMessagePeriod, setLastMessagePeriod] = useState('');
    const [availableCourses, setAvailableCourses] = useState<string[]>([]);
    const [sortBy, setSortBy] = useState('updated_at');
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

    // Column Visibility State
    const [visibleColumns, setVisibleColumns] = useState({
        name: true,
        phone: true,
        course: true,
        school: true,
        lastMessage: true,
        actions: true
    });
    const [showColumnSelector, setShowColumnSelector] = useState(false);

    // Selection State
    const [selectedLeads, setSelectedLeads] = useState<string[]>([]);

    // Message Modal State
    const [selectedContact, setSelectedContact] = useState<any>(null); // Can be single contact or 'bulk'
    const [message, setMessage] = useState('');
    const [sending, setSending] = useState(false);
    const [templates, setTemplates] = useState<any[]>([]);

    // Lead Form Modal State
    const [isLeadModalOpen, setIsLeadModalOpen] = useState(false);
    const [editingLead, setEditingLead] = useState<any>(null);
    const [leadFormData, setLeadFormData] = useState({
        nome: '',
        email: '',
        telefone: '',
        cpf: '',
        status: 'LEAD',
        tipo_ingresso: '',
        curso_interesse: '',
        escola: ''
    });
    const [savingLead, setSavingLead] = useState(false);

    useEffect(() => {
        fetchTemplates();
        fetchFilters();
    }, []);

    const fetchFilters = async () => {
        try {
            const res = await fetch('/api/filters');
            const data = await res.json();
            if (data.courses) {
                setAvailableCourses(data.courses);
            }
        } catch (error) {
            console.error('Error fetching filters:', error);
        }
    };

    const fetchTemplates = async () => {
        try {
            const res = await fetch('/api/templates');
            const data = await res.json();
            setTemplates(data);
        } catch (error) {
            console.error(error);
        }
    };

    useEffect(() => {
        const checkStatus = async () => {
            try {
                const res = await fetch('/api/whatsapp');
                const data = await res.json();
                setWaStatus(data.status);
            } catch (error) {
                console.error(error);
            }
        };

        checkStatus();
        const interval = setInterval(checkStatus, 5000);
        return () => clearInterval(interval);
    }, []);

    const fetchLeads = async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams({
                page: page.toString(),
                limit: itemsPerPage.toString(),
                search,
                status: 'LEAD', // Force filter for LEAD status
                course: courseFilter.join(','),
                exclude_existing_phones: 'true',
                last_message_period: lastMessagePeriod,
                sort_by: sortBy,
                sort_order: sortOrder
            });
            const res = await fetch(`/api/leads?${params}`);
            const data = await res.json();
            if (data.data) {
                setLeads(data.data);
                setTotalPages(data.pagination.totalPages);
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        const timer = setTimeout(() => {
            fetchLeads();
        }, 300);
        return () => clearTimeout(timer);
    }, [page, itemsPerPage, search, courseFilter, lastMessagePeriod, sortBy, sortOrder]);

    const handleSort = (column: string) => {
        if (sortBy === column) {
            setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
        } else {
            setSortBy(column);
            setSortOrder('asc');
        }
    };

    const SortIcon = ({ column }: { column: string }) => {
        if (sortBy !== column) return <div style={{ width: 16 }} />;
        return sortOrder === 'asc' ? <ChevronUp size={16} /> : <ChevronDown size={16} />;
    };

    const [selectedTemplateType, setSelectedTemplateType] = useState<string>('fixed');

    const handleTemplateSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const templateId = e.target.value;
        if (!templateId) return;

        const template = templates.find(t => t.id.toString() === templateId);
        if (template) {
            setMessage(template.content);
            setSelectedTemplateType(template.type || 'fixed');
        }
    };

    const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.checked) {
            setSelectedLeads(leads.map(l => l.cpf));
        } else {
            setSelectedLeads([]);
        }
    };

    const handleSelectLead = (cpf: string) => {
        if (selectedLeads.includes(cpf)) {
            setSelectedLeads(selectedLeads.filter(id => id !== cpf));
        } else {
            setSelectedLeads([...selectedLeads, cpf]);
        }
    };

    const handleSendMessage = async () => {
        if (!message.trim()) return;

        setSending(true);

        // Determine recipients
        let recipients: any[] = [];
        if (selectedContact && selectedContact !== 'bulk') {
            recipients = [selectedContact];
        } else {
            // Bulk send
            recipients = leads.filter(l => selectedLeads.includes(l.cpf));
        }

        if (recipients.length === 0) {
            toastWarning('Nenhum destinatário selecionado.');
            setSending(false);
            return;
        }

        try {
            const messages = recipients.map(r => ({
                phone: r.telefone,
                name: r.nome,
                message: message,
                isAi: selectedTemplateType === 'ai_prompt'
            }));

            const res = await fetch('/api/whatsapp/queue', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ messages })
            });

            if (res.ok) {
                toastSuccess('Mensagens adicionadas à fila de envio! Acompanhe o progresso na aba WhatsApp.');

                // Update local state to reflect "Last Message" immediately
                const now = new Date().toISOString();
                setLeads(prev => prev.map(l => {
                    if (recipients.some(r => r.cpf === l.cpf)) {
                        return { ...l, last_message_time: now, last_message: `(Enviada) ${message}` };
                    }
                    return l;
                }));

                setSelectedContact(null);
                setMessage('');
                if (selectedContact === 'bulk') setSelectedLeads([]);
            } else {
                toastError('Erro ao adicionar à fila.');
            }
        } catch (error) {
            console.error('Fetch error:', error);
            toastError('Erro ao enviar.');
        } finally {
            setSending(false);
        }
    };

    const openBulkModal = () => {
        if (selectedLeads.length === 0) return;
        setSelectedContact('bulk');
    };

    const handleDeleteContact = async (cpf: string) => {
        if (!confirm('Tem certeza que deseja excluir este lead?')) return;

        try {
            const res = await fetch(`/api/leads?cpf=${cpf}`, {
                method: 'DELETE'
            });

            if (res.ok) {
                toastSuccess('Lead excluído com sucesso!');
                fetchLeads();
                if (selectedLeads.includes(cpf)) {
                    setSelectedLeads(selectedLeads.filter(id => id !== cpf));
                }
            } else {
                toastError('Erro ao excluir lead');
            }
        } catch (error) {
            console.error(error);
            toastError('Erro ao excluir lead');
        }
    };

    const handleSyncProfilePic = async (lead: any) => {
        try {
            const res = await fetch('/api/whatsapp/sync-profile-pic', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ phone: lead.telefone, cpf: lead.cpf })
            });
            const data = await res.json();

            if (data.success && data.profile_image) {
                // Update local state
                setLeads(prev => prev.map(l => {
                    if (l.cpf === lead.cpf) {
                        return { ...l, profile_image: data.profile_image };
                    }
                    return l;
                }));
                toastSuccess('Foto de perfil sincronizada!');
            } else {
                toastWarning('Nenhuma foto encontrada ou erro ao sincronizar.');
            }
        } catch (error) {
            console.error('Error syncing profile pic:', error);
            toastError('Erro ao sincronizar foto.');
        }
    };

    const handleAddLead = () => {
        setEditingLead(null);
        setLeadFormData({
            nome: '',
            email: '',
            telefone: '',
            cpf: '',
            status: 'LEAD',
            tipo_ingresso: '',
            curso_interesse: '',
            escola: ''
        });
        setIsLeadModalOpen(true);
    };

    const handleEditLead = (lead: any) => {
        setEditingLead(lead);
        setLeadFormData({
            nome: lead.nome,
            email: lead.email || '',
            telefone: lead.telefone,
            cpf: lead.cpf,
            status: lead.status,
            tipo_ingresso: lead.tipo_ingresso || '',
            curso_interesse: lead.curso_interesse || '',
            escola: lead.escola || ''
        });
        setIsLeadModalOpen(true);
    };

    const handleSaveLead = async (e: React.FormEvent) => {
        e.preventDefault();
        setSavingLead(true);

        try {
            const url = '/api/leads';
            const method = editingLead ? 'PUT' : 'POST';
            const body = {
                ...leadFormData,
                originalCpf: editingLead ? editingLead.cpf : undefined
            };

            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });

            const data = await res.json();

            if (res.ok) {
                toastSuccess(editingLead ? 'Lead atualizado com sucesso!' : 'Lead criado com sucesso!');
                setIsLeadModalOpen(false);
                fetchLeads();
            } else {
                console.error('Server error:', data);
                toastError(data.error || 'Erro ao salvar lead');
            }
        } catch (error) {
            console.error('Error saving lead:', error);
            toastError('Erro ao salvar lead');
        } finally {
            setSavingLead(false);
        }
    };

    // Get status color for avatar border/background
    const getStatusColor = (status: string) => {
        return '#7e22ce'; // Always purple for LEAD
    };

    return (
        <div className={styles.container}>
            <header className={styles.header}>
                <div>
                    <h1 className={styles.title}>Novos Leads</h1>
                    <p className={styles.subtitle}>Leads importados via planilha simples</p>
                </div>
                <div className={styles.headerActions}>
                    <button
                        className={styles.primaryButton}
                        onClick={handleAddLead}
                    >
                        <Plus size={18} />
                        Adicionar Lead
                    </button>
                    <a
                        href="/import?type=leads"
                        className={styles.secondaryButton}
                        style={{ display: 'flex', alignItems: 'center', gap: '8px', textDecoration: 'none' }}
                    >
                        <Upload size={18} />
                        Importar
                    </a>
                    {selectedLeads.length > 0 && (
                        <button
                            className={styles.bulkButton}
                            onClick={openBulkModal}
                            disabled={waStatus !== 'ready'}
                            title={waStatus !== 'ready' ? "WhatsApp Disconnected" : "Send to selected"}
                        >
                            <MessageSquare size={18} />
                            Send to {selectedLeads.length} selected
                        </button>
                    )}
                </div>
            </header>

            <div className={styles.card}>
                <div className={styles.cardHeader}>
                    <div className={styles.searchBox}>
                        <Search size={18} className={styles.searchIcon} />
                        <input
                            type="text"
                            placeholder="Pesquisar por nome ou telefone..."
                            value={search}
                            onChange={(e) => {
                                setSearch(e.target.value);
                                setPage(1);
                            }}
                            className={styles.searchInput}
                        />
                    </div>

                    <div className={styles.filters}>
                        <div className={styles.filterGroup}>
                            <span className={styles.filterLabel}>Curso:</span>
                            <MultiSelect
                                options={availableCourses}
                                selected={courseFilter}
                                onChange={(selected) => {
                                    setCourseFilter(selected);
                                    setPage(1);
                                }}
                                placeholder="Todos os Cursos"
                            />
                        </div>
                        <div className={styles.filterGroup}>
                            <span className={styles.filterLabel}>Última Mensagem:</span>
                            <select
                                value={lastMessagePeriod}
                                onChange={(e) => {
                                    setLastMessagePeriod(e.target.value);
                                    setPage(1);
                                }}
                                className={styles.select}
                            >
                                <option value="">Todos</option>
                                <option value="1h">Menos de 1h</option>
                                <option value="today">Últimas 24h</option>
                                <option value="1-3d">1 a 3 dias</option>
                                <option value="3-7d">3 a 7 dias</option>
                                <option value="7-15d">7 a 15 dias</option>
                                <option value="15d+">+15 dias</option>
                                <option value="never">Nunca</option>
                            </select>
                        </div>
                    </div>
                </div>

                <div className={styles.tableContainer}>
                    {/* Column Selector */}
                    <div style={{ padding: '8px 16px', display: 'flex', justifyContent: 'flex-end', position: 'relative' }}>
                        <button
                            className={styles.secondaryButton}
                            onClick={() => setShowColumnSelector(!showColumnSelector)}
                            style={{ fontSize: '0.875rem', padding: '4px 8px' }}
                        >
                            <Filter size={14} style={{ marginRight: 4 }} /> Colunas
                        </button>
                        {showColumnSelector && (
                            <div className={styles.dropdown} style={{ right: 16, top: 40, width: 200, zIndex: 100 }}>
                                <div className={styles.dropdownHeader}>Exibir Colunas</div>
                                <div className={styles.dropdownList}>
                                    {Object.keys(visibleColumns).map(key => (
                                        <label key={key} className={styles.dropdownItem} style={{ display: 'flex', gap: 8, cursor: 'pointer' }}>
                                            <input
                                                type="checkbox"
                                                checked={visibleColumns[key as keyof typeof visibleColumns]}
                                                onChange={(e) => setVisibleColumns(prev => ({ ...prev, [key]: e.target.checked }))}
                                            />
                                            {key.charAt(0).toUpperCase() + key.slice(1)}
                                        </label>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    <table className={styles.table}>
                        <thead>
                            <tr>
                                <th style={{ width: '40px' }}>
                                    <input
                                        type="checkbox"
                                        onChange={handleSelectAll}
                                        checked={leads.length > 0 && selectedLeads.length === leads.length}
                                        className={styles.checkbox}
                                    />
                                </th>
                                {visibleColumns.name && (
                                    <th onClick={() => handleSort('nome')} style={{ cursor: 'pointer' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                            Nome <SortIcon column="nome" />
                                        </div>
                                    </th>
                                )}
                                {visibleColumns.phone && (
                                    <th onClick={() => handleSort('telefone')} style={{ cursor: 'pointer' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                            Telefone <SortIcon column="telefone" />
                                        </div>
                                    </th>
                                )}
                                {visibleColumns.course && (
                                    <th onClick={() => handleSort('curso_interesse')} style={{ cursor: 'pointer' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                            Curso de Interesse <SortIcon column="curso_interesse" />
                                        </div>
                                    </th>
                                )}
                                {visibleColumns.school && (
                                    <th onClick={() => handleSort('escola')} style={{ cursor: 'pointer' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                            Escola <SortIcon column="escola" />
                                        </div>
                                    </th>
                                )}
                                {visibleColumns.lastMessage && (
                                    <th onClick={() => handleSort('last_message_time')} style={{ cursor: 'pointer' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                            Última Mensagem <SortIcon column="last_message_time" />
                                        </div>
                                    </th>
                                )}
                                {visibleColumns.actions && <th style={{ textAlign: 'right' }}>Ações</th>}
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr>
                                    <td colSpan={10} className={styles.loadingCell}>
                                        <RefreshCw className={styles.spin} size={24} />
                                    </td>
                                </tr>
                            ) : leads.length > 0 ? (
                                leads.map((lead) => (
                                    <tr key={lead.cpf} className={selectedLeads.includes(lead.cpf) ? styles.selectedRow : ''}>
                                        <td>
                                            <input
                                                type="checkbox"
                                                checked={selectedLeads.includes(lead.cpf)}
                                                onChange={() => handleSelectLead(lead.cpf)}
                                                className={styles.checkbox}
                                            />
                                        </td>
                                        {visibleColumns.name && (
                                            <td className={styles.nameCell}>
                                                <div
                                                    className={styles.avatarPlaceholder}
                                                    style={{
                                                        backgroundImage: lead.profile_image ? `url(${lead.profile_image})` : 'none',
                                                        backgroundColor: lead.profile_image ? 'transparent' : getStatusColor(lead.status),
                                                        border: `3px solid ${getStatusColor(lead.status)}`,
                                                        color: lead.profile_image ? 'transparent' : 'white'
                                                    }}
                                                >
                                                    {!lead.profile_image && lead.nome.charAt(0).toUpperCase()}
                                                </div>
                                                <div>
                                                    <div className={styles.leadName}>
                                                        {lead.nome}
                                                        {lead.unread_count > 0 && <span className={styles.unreadDot} title={`${lead.unread_count} novas mensagens`}></span>}
                                                    </div>
                                                </div>
                                            </td>
                                        )}
                                        {visibleColumns.phone && (
                                            <td className={styles.td}>
                                                <div style={{ display: 'flex', alignItems: 'center' }}>
                                                    {lead.telefone}
                                                    <WhatsAppIndicator phone={lead.telefone} />
                                                </div>
                                            </td>
                                        )}
                                        {visibleColumns.course && <td className={styles.textCell}>{lead.curso_interesse || '-'}</td>}
                                        {visibleColumns.school && <td className={styles.textCell}>{lead.escola || '-'}</td>}
                                        {visibleColumns.lastMessage && (
                                            <td className={styles.textCell}>
                                                <TimeAgoBadge date={lead.last_message_time} />
                                            </td>
                                        )}
                                        {visibleColumns.actions && (
                                            <td style={{ textAlign: 'right' }}>
                                                <div className={styles.actionButtons}>
                                                    <button
                                                        className={styles.actionButton}
                                                        onClick={() => handleDeleteContact(lead.cpf)}
                                                        title="Excluir"
                                                        style={{ color: 'var(--danger)' }}
                                                    >
                                                        <Trash2 size={18} />
                                                    </button>
                                                    <button
                                                        className={styles.actionButton}
                                                        onClick={() => handleEditLead(lead)}
                                                        title="Editar"
                                                    >
                                                        <Edit2 size={18} />
                                                    </button>
                                                    <button
                                                        className={styles.actionButton}
                                                        onClick={() => handleSyncProfilePic(lead)}
                                                        title="Sincronizar Foto"
                                                    >
                                                        <RefreshCw size={18} />
                                                    </button>
                                                    <button
                                                        className={styles.actionButton}
                                                        onClick={() => {
                                                            setSelectedContact(lead);
                                                            if (lead.unread_count > 0) {
                                                                fetch('/api/notifications', {
                                                                    method: 'POST',
                                                                    headers: { 'Content-Type': 'application/json' },
                                                                    body: JSON.stringify({ cpf: lead.cpf })
                                                                }).then(() => fetchLeads()); // Refresh to clear badge
                                                            }
                                                        }}
                                                        title={waStatus === 'ready' ? "Enviar WhatsApp" : "WhatsApp Desconectado"}
                                                        disabled={waStatus !== 'ready'}
                                                    >
                                                        <MessageSquare size={18} />
                                                    </button>
                                                </div>
                                            </td>
                                        )}
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={10} className={styles.emptyCell}>
                                        Nenhum lead encontrado
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                <div className={styles.pagination}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span className={styles.pageInfo} style={{ marginRight: 0 }}>Exibir:</span>
                        <select
                            value={itemsPerPage}
                            onChange={(e) => {
                                setItemsPerPage(Number(e.target.value));
                                setPage(1);
                            }}
                            className={styles.select}
                            style={{ padding: '4px 8px', fontSize: '0.875rem', width: 'auto' }}
                        >
                            <option value={25}>25</option>
                            <option value={50}>50</option>
                            <option value={100}>100</option>
                        </select>
                    </div>

                    <span className={styles.pageInfo}>
                        Página {page} de {totalPages || 1}
                    </span>
                    <div className={styles.paginationControls}>
                        <button
                            onClick={() => setPage(p => Math.max(1, p - 1))}
                            disabled={page === 1 || loading}
                            className={styles.pageButton}
                        >
                            <ChevronLeft size={18} />
                        </button>
                        <button
                            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                            disabled={page === totalPages || loading}
                            className={styles.pageButton}
                        >
                            <ChevronRight size={18} />
                        </button>
                    </div>
                </div>
            </div >

            {/* Message Modal */}
            {
                selectedContact && (
                    <div className={styles.modalOverlay}>
                        <div className={styles.modal}>
                            <div className={styles.modalHeader}>
                                <h3>{selectedContact === 'bulk' ? `Enviar para ${selectedLeads.length} contatos` : 'Enviar Mensagem'}</h3>
                                <button type="button" onClick={() => setSelectedContact(null)} className={styles.closeButton}>
                                    <X size={20} />
                                </button>
                            </div>
                            <div className={styles.modalBody}>
                                {selectedContact !== 'bulk' ? (
                                    <div className={styles.recipientInfo}>
                                        <div className={styles.avatarLarge}>
                                            {selectedContact.nome.charAt(0).toUpperCase()}
                                        </div>
                                        <div>
                                            <p className={styles.recipientName}>{selectedContact.nome}</p>
                                            <p className={styles.recipientPhone}>
                                                +55 {selectedContact.telefone.replace(/\D/g, '').replace(/^0/, '')}
                                            </p>
                                        </div>
                                    </div>
                                ) : (
                                    <div className={styles.bulkInfo}>
                                        <p>Você está prestes a enviar uma mensagem para <strong>{selectedLeads.length}</strong> contatos selecionados.</p>
                                        <p className={styles.warningText}>Certifique-se de que a mensagem é genérica o suficiente.</p>
                                    </div>
                                )}

                                <div className={styles.inputGroup}>
                                    <label>Modelo de Mensagem</label>
                                    <select className={styles.select} onChange={handleTemplateSelect} defaultValue="">
                                        <option value="">Selecione um modelo...</option>
                                        {templates.map(t => (
                                            <option key={t.id} value={t.id}>{t.title}</option>
                                        ))}
                                    </select>
                                </div>

                                <div className={styles.inputGroup}>
                                    <label>Mensagem</label>
                                    <textarea
                                        className={styles.textarea}
                                        rows={5}
                                        placeholder="Digite sua mensagem..."
                                        value={message}
                                        onChange={(e) => setMessage(e.target.value)}
                                    />
                                </div>

                                <div className={styles.modalFooter}>
                                    <button
                                        type="button"
                                        className={styles.secondaryButton}
                                        onClick={() => setSelectedContact(null)}
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                        type="button"
                                        className={styles.primaryButton}
                                        onClick={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            handleSendMessage();
                                        }}
                                        disabled={sending || !message.trim()}
                                    >
                                        {sending ? <RefreshCw className={styles.spin} size={18} /> : <Send size={18} />}
                                        <span>{selectedContact === 'bulk' ? 'Enviar em Massa' : 'Enviar'}</span>
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )
            }
            {/* Lead Form Modal */}
            {isLeadModalOpen && (
                <div className={styles.modalOverlay}>
                    <div className={styles.modal}>
                        <div className={styles.modalHeader}>
                            <h3>{editingLead ? 'Editar Lead' : 'Novo Lead'}</h3>
                            <button type="button" onClick={() => setIsLeadModalOpen(false)} className={styles.closeButton}>
                                <X size={20} />
                            </button>
                        </div>
                        <form onSubmit={handleSaveLead}>
                            <div className={styles.modalBody}>
                                <div className={styles.inputGroup}>
                                    <label>Nome *</label>
                                    <input
                                        type="text"
                                        className={styles.input}
                                        required
                                        value={leadFormData.nome}
                                        onChange={e => setLeadFormData({ ...leadFormData, nome: e.target.value })}
                                    />
                                </div>
                                <div className={styles.row}>
                                    <div className={styles.inputGroup}>
                                        <label>Telefone *</label>
                                        <input
                                            type="text"
                                            className={styles.input}
                                            required
                                            placeholder="5551999999999"
                                            value={leadFormData.telefone}
                                            onChange={e => setLeadFormData({ ...leadFormData, telefone: e.target.value })}
                                        />
                                    </div>
                                    <div className={styles.inputGroup}>
                                        <label>CPF</label>
                                        <input
                                            type="text"
                                            className={styles.input}
                                            value={leadFormData.cpf}
                                            onChange={e => setLeadFormData({ ...leadFormData, cpf: e.target.value })}
                                        />
                                    </div>
                                </div>
                                <div className={styles.inputGroup}>
                                    <label>Email</label>
                                    <input
                                        type="email"
                                        className={styles.input}
                                        value={leadFormData.email}
                                        onChange={e => setLeadFormData({ ...leadFormData, email: e.target.value })}
                                    />
                                </div>
                                <div className={styles.row}>
                                    <div className={styles.inputGroup}>
                                        <label>Curso de Interesse</label>
                                        <input
                                            type="text"
                                            className={styles.input}
                                            value={leadFormData.curso_interesse}
                                            onChange={e => setLeadFormData({ ...leadFormData, curso_interesse: e.target.value })}
                                        />
                                    </div>
                                    <div className={styles.inputGroup}>
                                        <label>Escola</label>
                                        <input
                                            type="text"
                                            className={styles.input}
                                            value={leadFormData.escola}
                                            onChange={e => setLeadFormData({ ...leadFormData, escola: e.target.value })}
                                        />
                                    </div>
                                </div>
                                <div className={styles.inputGroup}>
                                    <label>Status</label>
                                    <select
                                        className={styles.select}
                                        value={leadFormData.status}
                                        onChange={e => setLeadFormData({ ...leadFormData, status: e.target.value })}
                                        style={{ width: '100%' }}
                                    >
                                        <option value="LEAD">Lead</option>
                                        <option value="NOVO">Novo</option>
                                        <option value="EM_ATENDIMENTO">Em Atendimento</option>
                                        <option value="AGENDADO">Agendado</option>
                                        <option value="VISITOU">Visitou</option>
                                        <option value="INSCRITO">Inscrito</option>
                                        <option value="APROVADO">Aprovado</option>
                                        <option value="MATRICULADO">Matriculado</option>
                                        <option value="PENDENTE">Pendente</option>
                                        <option value="INTERESSADO">Interessado</option>
                                        <option value="CANCELADO">Cancelado</option>
                                        <option value="PERDIDO">Perdido</option>
                                    </select>
                                </div>
                            </div>
                            <div className={styles.modalFooter}>
                                <button
                                    type="button"
                                    className={styles.secondaryButton}
                                    onClick={() => setIsLeadModalOpen(false)}
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    className={styles.primaryButton}
                                    disabled={savingLead}
                                >
                                    {savingLead ? <RefreshCw className={styles.spin} size={18} /> : (editingLead ? 'Salvar Alterações' : 'Criar Lead')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
