// Export to treat as module
export { };

async function runCrudTest() {
    const baseUrl = 'http://localhost:3000/api/leads';

    // 1. Create a lead
    console.log('Creating lead...');
    const createRes = await fetch(baseUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            nome: 'Test User',
            email: 'test@example.com',
            telefone: '5551999999999',
            cpf: '123.456.789-00',
            status: 'NOVO',
            tipo_ingresso: '2025/1'
        })
    });
    console.log('Create status:', createRes.status);
    if (!createRes.ok) console.log(await createRes.text());

    // 2. Update the lead
    console.log('Updating lead...');
    const updateRes = await fetch(baseUrl, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            nome: 'Test User Updated',
            email: 'test@example.com',
            telefone: '5551999999999',
            cpf: '123.456.789-00',
            status: 'INSCRITO',
            tipo_ingresso: '2025/1',
            originalCpf: '123.456.789-00'
        })
    });
    console.log('Update status:', updateRes.status);
    if (!updateRes.ok) console.log(await updateRes.text());

    // 3. Delete the lead
    console.log('Deleting lead...');
    const deleteRes = await fetch(`${baseUrl}?cpf=123.456.789-00`, {
        method: 'DELETE'
    });
    console.log('Delete status:', deleteRes.status);
    if (!deleteRes.ok) console.log(await deleteRes.text());
}

runCrudTest().catch(console.error);
