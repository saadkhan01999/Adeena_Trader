/**
 * ============================================
 * Partners
 * ============================================
 * Business partners who hold an ownership share.
 *
 * Partners differ from investors in one way that matters religiously as well as
 * commercially: a partner's share of the stock, receivables and cash IS part of
 * their zakatable wealth, so the Zakat screen calculates for each of them.
 */

import { useState } from 'react';
import {
  UsersRound, Percent, Wallet, TrendingUp, FileSignature, Phone,
  IdCard, Building2, HandCoins,
} from 'lucide-react';

import { createListPage, RowActions } from '../../components/common/createListPage.jsx';
import {
  Input, Textarea, Select, CurrencyInput, CNICInput, PhoneInput,
  FormRow, FormSection, FieldDisplay,
} from '../../components/common/Form.jsx';
import { AvatarUpload } from '../../components/common/FileUpload.jsx';
import Badge from '../../components/common/Badge.jsx';
import Button, { IconButton } from '../../components/common/Button.jsx';
import StatCard, { StatGrid } from '../../components/common/StatCard.jsx';
import { MoneyCell } from '../../components/common/DataTable.jsx';
import { partnerService, agreementService } from '../../services/entities.js';
import { useToastStore } from '../../context/toastStore.js';
import {
  formatCurrency, formatDate, getTelURL, getInitials, resolveFileUrl, sumBy, toDateInput,
} from '../../utils/index.js';
import { DOCUMENT_TYPES } from '../../constants/index.js';

export default createListPage({
  guideId: 'partners',
  entityName: 'Partner',
  entityNamePlural: 'Partners',
  collectionKey: 'partners',
  icon: UsersRound,
  service: partnerService,
  permission: 'partners',
  searchPlaceholder: 'Search by name, phone or CNIC…',
  subtitle: 'Partners share profit, loss and Zakat in proportion to their capital',

  getInitialForm: () => ({
    name: '',
    phone: '',
    email: '',
    cnic: '',
    address: '',
    photo: null,
    ownershipPercent: 0,
    capitalInvested: '',
    agreementDate: toDateInput(new Date()),
    status: 'active',
    notes: '',
  }),

  renderForm: (form, setForm) => (
    <>
      <FormSection title="Partner details" icon={IdCard}>
        <AvatarUpload
          label="Photo"
          value={form.photo}
          onChange={(url) => setForm({ ...form, photo: url })}
          folder="misc"
        />

        <FormRow cols={2}>
          <Input
            label="Full name"
            required
            autoFocus
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
          <CNICInput
            label="CNIC"
            value={form.cnic}
            onChange={(e) => setForm({ ...form, cnic: e.target.value })}
          />
        </FormRow>

        <FormRow cols={2}>
          <PhoneInput
            label="Phone"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
          />
          <Input
            label="Email"
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
        </FormRow>

        <Textarea
          label="Address"
          value={form.address}
          onChange={(e) => setForm({ ...form, address: e.target.value })}
          rows={2}
        />
      </FormSection>

      <FormSection
        title="Partnership terms"
        icon={Percent}
        description="Profit is shared by this percentage; loss is borne in proportion to capital"
      >
        <FormRow cols={3}>
          <Input
            label="Ownership share"
            type="number"
            min={0}
            max={100}
            required
            value={form.ownershipPercent}
            onChange={(e) => setForm({ ...form, ownershipPercent: Number(e.target.value) })}
            suffix="%"
          />
          <CurrencyInput
            label="Capital contributed"
            value={form.capitalInvested}
            onChange={(e) => setForm({ ...form, capitalInvested: e.target.value })}
            showPreview={false}
          />
          <Input
            label="Agreement date"
            type="date"
            value={toDateInput(form.agreementDate)}
            onChange={(e) => setForm({ ...form, agreementDate: e.target.value })}
          />
        </FormRow>

        <Select
          label="Status"
          value={form.status}
          onChange={(e) => setForm({ ...form, status: e.target.value })}
          options={[
            { value: 'active', label: 'Active' },
            { value: 'inactive', label: 'Inactive' },
          ]}
        />

        <Textarea
          label="Notes"
          value={form.notes}
          onChange={(e) => setForm({ ...form, notes: e.target.value })}
          rows={2}
          maxLength={500}
        />
      </FormSection>
    </>
  ),

  renderSummary: (summary, { records }) => {
    const totalShare = sumBy(records, 'ownershipPercent');

    return (
      <StatGrid columns={4}>
        <StatCard
          label="Partners"
          value={records.length}
          icon={UsersRound}
          variant="navy"
          isCurrency={false}
        />
        <StatCard
          label="Combined share"
          value={`${totalShare}%`}
          icon={Percent}
          variant={totalShare > 100 ? 'red' : 'gold'}
          isCurrency={false}
          subtitle={totalShare > 100 ? 'Over 100% — please review' : `Owner holds ${100 - totalShare}%`}
        />
        <StatCard
          label="Capital contributed"
          value={sumBy(records, 'capitalInvested')}
          icon={Wallet}
          variant="blue"
          compact
        />
        <StatCard
          label="Profit earned"
          value={sumBy(records, 'totalProfit')}
          icon={TrendingUp}
          variant="green"
          compact
        />
      </StatGrid>
    );
  },

  columns: ({ onEdit, onDelete, onView, canManage }) => [
    {
      accessor: 'name',
      header: 'Partner',
      sortable: true,
      primary: true,
      render: (partner) => (
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="flex items-center justify-center w-9 h-9 rounded-full bg-navy-100 text-navy-600 text-2xs font-bold flex-shrink-0 overflow-hidden">
            {partner.photo ? (
              <img src={resolveFileUrl(partner.photo)} alt="" className="w-full h-full object-cover" />
            ) : (
              getInitials(partner.name)
            )}
          </span>
          <div className="min-w-0">
            <p className="font-medium text-navy-950 truncate">{partner.name}</p>
            <p className="text-2xs text-navy-500 tabular">{partner.cnic || partner.phone}</p>
          </div>
        </div>
      ),
      exportValue: (partner) => partner.name,
    },
    {
      accessor: 'ownershipPercent',
      header: 'Share',
      align: 'center',
      sortable: true,
      secondary: true,
      render: (partner) => (
        <Badge variant="gold" size="sm">{partner.ownershipPercent}%</Badge>
      ),
      exportValue: (partner) => partner.ownershipPercent,
    },
    {
      accessor: 'capitalInvested',
      header: 'Capital',
      align: 'right',
      sortable: true,
      hideOnMobile: true,
      render: (partner) => <MoneyCell value={partner.capitalInvested} />,
      exportValue: (partner) => partner.capitalInvested,
    },
    {
      accessor: 'totalSales',
      header: 'Sales share',
      align: 'right',
      hideOnMobile: true,
      render: (partner) => <MoneyCell value={partner.totalSales} />,
      exportValue: (partner) => partner.totalSales,
    },
    {
      accessor: 'totalProfit',
      header: 'Profit',
      align: 'right',
      sortable: true,
      render: (partner) => <MoneyCell value={partner.totalProfit} className="text-success-700" />,
      exportValue: (partner) => partner.totalProfit,
    },
    {
      accessor: 'status',
      header: 'Status',
      hideOnMobile: true,
      render: (partner) => (
        <Badge variant={partner.status === 'active' ? 'success' : 'neutral'} size="sm">
          {partner.status}
        </Badge>
      ),
      exportValue: (partner) => partner.status,
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (partner) => (
        <RowActions
          record={partner}
          onEdit={onEdit}
          onDelete={onDelete}
          onView={onView}
          canManage={canManage}
          extraActions={<IssueAgreementButton partner={partner} />}
        />
      ),
    },
  ],

  renderDetail: (partner) => (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <span className="flex items-center justify-center w-14 h-14 rounded-full bg-navy-100 text-navy-600 font-bold overflow-hidden">
          {partner.photo ? (
            <img src={resolveFileUrl(partner.photo)} alt="" className="w-full h-full object-cover" />
          ) : (
            getInitials(partner.name)
          )}
        </span>
        <div className="min-w-0">
          <p className="font-display font-semibold text-navy-950">{partner.name}</p>
          <p className="text-xs text-navy-500">
            {partner.ownershipPercent}% share · partner since {formatDate(partner.agreementDate)}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <FieldDisplay label="CNIC" value={partner.cnic} mono />
        <FieldDisplay label="Phone" value={partner.phone} mono icon={Phone} />
        <FieldDisplay label="Email" value={partner.email} />
        <FieldDisplay label="Status" value={partner.status} />
      </div>

      <FieldDisplay label="Address" value={partner.address} />

      <div>
        <p className="label">Their share of the business</p>
        <div className="grid grid-cols-2 gap-2">
          {[
            { label: 'Capital contributed', value: partner.capitalInvested },
            { label: 'Stock value', value: partner.stockValue },
            { label: 'Sales', value: partner.totalSales },
            { label: 'Collected', value: partner.totalCollection },
            { label: 'Receivable', value: partner.totalReceivable, tone: 'text-warning-600' },
            { label: 'Profit', value: partner.totalProfit, tone: 'text-success-700' },
          ].map((item) => (
            <div key={item.label} className="rounded-lg bg-navy-50 border border-navy-100 p-2.5">
              <p className="text-2xs text-navy-500">{item.label}</p>
              <p className={`text-sm font-semibold tabular mt-0.5 ${item.tone || 'text-navy-950'}`}>
                {formatCurrency(item.value)}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Partners are in scope for Zakat; investors are not */}
      <div className="flex items-start gap-2.5 rounded-lg bg-gold-50 border border-gold-200 p-3">
        <HandCoins size={16} className="text-gold-600 flex-shrink-0 mt-0.5" />
        <p className="text-2xs text-navy-700 leading-relaxed">
          This partner&apos;s share of the stock, receivables and cash is zakatable. Run their Zakat
          calculation from the Zakat screen by selecting them as the partner.
        </p>
      </div>

      {partner.notes && <FieldDisplay label="Notes" value={partner.notes} />}

      {partner.phone && (
        <a href={getTelURL(partner.phone)} className="btn-secondary btn w-full justify-center">
          <Phone size={15} /> Call {partner.name.split(' ')[0]}
        </a>
      )}
    </div>
  ),
});

/**
 * Issues the partnership agreement from the current template.
 * Placed on the row so it is reachable without opening the record.
 */
function IssueAgreementButton({ partner }) {
  const toast = useToastStore();
  const [issuing, setIssuing] = useState(false);

  const handleIssue = async (event) => {
    event.stopPropagation();
    setIssuing(true);
    try {
      const response = await agreementService.create({
        type: DOCUMENT_TYPES.PARTNER_AGREEMENT,
        partnerId: partner._id,
      });
      toast.success(`Agreement ${response.data.agreement.agreementNumber} issued. Open it from the Agreements screen to print.`);
    } catch (error) {
      toast.apiError(error, 'Could not issue the agreement.');
    } finally {
      setIssuing(false);
    }
  };

  return (
    <IconButton
      icon={FileSignature}
      label="Issue a partnership agreement"
      size="icon-sm"
      onClick={handleIssue}
      disabled={issuing}
    />
  );
}
