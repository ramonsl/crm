# Guia: Deploy do CRM em EC2 com Coolify

## Visão Geral
Este guia configura uma EC2 com **Coolify** (interface visual tipo Railway) para deploy automático do CRM.

**Custo estimado:** ~$18-25/mês (EC2 t3.small + domínio)

---

## Passo 1: Criar EC2 na AWS

### 1.1 Acessar AWS Console
1. Acesse [console.aws.amazon.com](https://console.aws.amazon.com)
2. Vá em **EC2** → **Launch Instance**

### 1.2 Configurações da Instância

| Campo | Valor |
|-------|-------|
| Nome | `crm-production` |
| AMI | **Ubuntu Server 22.04 LTS** |
| Tipo | **t3.small** (2GB RAM, 2 vCPU) |
| Key Pair | Criar nova ou usar existente |
| Storage | 30 GB gp3 |

### 1.3 Security Group (Firewall)

Abrir as portas:
| Porta | Tipo | Descrição |
|-------|------|-----------|
| 22 | SSH | Acesso remoto |
| 80 | HTTP | Tráfego web |
| 443 | HTTPS | Tráfego seguro |
| 8000 | Custom | Coolify Dashboard |

### 1.4 Elastic IP (IP Fixo)
1. EC2 → **Elastic IPs** → **Allocate**
2. Associar ao seu instance
3. Anotar o IP: `___.___.___.__`

---

## Passo 2: Acessar a EC2 via SSH

```bash
# Dar permissão à chave
chmod 400 sua-chave.pem

# Conectar
ssh -i sua-chave.pem ubuntu@SEU_IP_AQUI
```

---

## Passo 3: Instalar Coolify

```bash
# Atualizar sistema
sudo apt update && sudo apt upgrade -y

# Instalar Coolify (um comando!)
curl -fsSL https://cdn.coollabs.io/coolify/install.sh | sudo bash
```

Aguarde ~5 minutos. Ao final, você verá:
```
Coolify is ready! 🎉
Dashboard: http://SEU_IP:8000
```

---

## Passo 4: Configurar Coolify

### 4.1 Acessar Dashboard
1. Abra no navegador: `http://SEU_IP:8000`
2. Crie sua conta admin
3. Faça login

### 4.2 Conectar GitHub
1. **Settings** → **Sources** → **Add GitHub App**
2. Autorize o Coolify a acessar seu repo
3. Selecione o repositório `crm`

### 4.3 Criar Aplicação
1. **Projects** → **Add New** → **Application**
2. **Source**: GitHub
3. **Repository**: seu-usuario/crm
4. **Branch**: main
5. **Build Pack**: Nixpacks (detecta Next.js automaticamente)

### 4.4 Variáveis de Ambiente
Vá em **Environment Variables** e adicione:

```env
DATABASE_URL=postgresql://...
OPENAI_API_KEY=sk-...
NODE_ENV=production
# ... suas outras variáveis
```

### 4.5 Deploy!
Clique em **Deploy** e acompanhe os logs em tempo real.

---

## Passo 5: Configurar Domínio (Opcional)

### 5.1 DNS
No seu provedor de domínio, crie um registro A:
```
crm.seudominio.com → SEU_IP_ELASTICO
```

### 5.2 SSL no Coolify
1. Na aplicação, vá em **Settings**
2. **Domain**: `crm.seudominio.com`
3. Ative **Generate SSL Certificate**
4. Coolify gera SSL automaticamente via Let's Encrypt

---

## Passo 6: Deploy Automático

O Coolify já configura webhook automaticamente!

Fluxo:
1. Você faz `git push origin main`
2. GitHub notifica Coolify
3. Coolify faz build e deploy
4. Você vê os logs em tempo real no dashboard

---

## Checklist Final

- [ ] EC2 criada com Ubuntu 22.04
- [ ] Elastic IP associado
- [ ] Portas 22, 80, 443, 8000 abertas
- [ ] Coolify instalado
- [ ] GitHub conectado
- [ ] Variáveis de ambiente configuradas
- [ ] Primeiro deploy feito
- [ ] (Opcional) Domínio + SSL configurado

---

## Comandos Úteis

```bash
# Ver status do Coolify
sudo docker ps

# Logs do Coolify
sudo docker logs coolify -f

# Reiniciar Coolify
sudo docker restart coolify

# Acessar servidor
ssh -i chave.pem ubuntu@SEU_IP
```

---

## Troubleshooting

### Erro de memória no build
```bash
# Criar swap de 2GB
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile swap swap defaults 0 0' | sudo tee -a /etc/fstab
```

### Chrome/Puppeteer não inicia
```bash
# Instalar dependências do Chrome
sudo apt install -y chromium-browser
```

---

## Custos Detalhados

| Item | Custo/mês |
|------|-----------|
| EC2 t3.small | ~$15 |
| Elastic IP (se não usar) | ~$4 |
| Storage 30GB | ~$2.50 |
| **Total** | **~$18-22** |

Comparado ao Railway Pro (~$40-80/mês), você economiza **50-70%**.
