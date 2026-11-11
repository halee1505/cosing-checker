import { useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  Divider,
  Drawer,
  IconButton,
  Link,
  Paper,
  Skeleton,
  Stack,
  Tooltip,
  Typography,
} from "@mui/material";
import CloseRounded from "@mui/icons-material/CloseRounded";
import OpenInNewRounded from "@mui/icons-material/OpenInNewRounded";
import ContentCopyRounded from "@mui/icons-material/ContentCopyRounded";
import DescriptionOutlined from "@mui/icons-material/DescriptionOutlined";
import {
  ANNEX_INFO,
  COSING_DETAIL_URL,
  CosingRecord,
  fetchByIds,
  verdictFor,
} from "../lib/cosing";
import { AnnexChips, StatusChip } from "./StatusChip";

function Field({ label, value, mono }: { label: string; value?: string; mono?: boolean }) {
  if (!value) return null;
  return (
    <Box>
      <Typography variant="caption" color="text.secondary" fontWeight={600}>
        {label}
      </Typography>
      <Stack direction="row" alignItems="center" spacing={0.5}>
        <Typography
          variant="body2"
          sx={{
            whiteSpace: "pre-line",
            fontFamily: mono ? "ui-monospace, Menlo, monospace" : undefined,
            wordBreak: "break-word",
          }}
        >
          {value}
        </Typography>
        {mono && (
          <Tooltip title="Sao chép">
            <IconButton size="small" onClick={() => navigator.clipboard?.writeText(value)}>
              <ContentCopyRounded sx={{ fontSize: 14 }} />
            </IconButton>
          </Tooltip>
        )}
      </Stack>
    </Box>
  );
}

function AnnexEntry({ rec }: { rec: CosingRecord }) {
  const tone = rec.annexRefs.some((a) => a.annex === "II")
    ? "error.main"
    : rec.annexRefs.some((a) => a.annex === "III")
    ? "warning.main"
    : "info.main";
  return (
    <Paper variant="outlined" sx={{ p: 2, borderLeft: 4, borderLeftColor: tone }}>
      <Stack spacing={1.25}>
        <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1}>
          <Box>
            <Typography variant="subtitle2">{rec.inciName}</Typography>
            {rec.annexRefs.map((a) => (
              <Typography key={a.annex + a.ref} variant="caption" color="text.secondary" display="block">
                {ANNEX_INFO[a.annex]?.label} · mục {a.ref}
              </Typography>
            ))}
          </Box>
          <AnnexChips refs={rec.annexRefs} />
        </Stack>
        <Field label="Nồng độ tối đa trong sản phẩm" value={rec.maximumConcentration} />
        <Field label="Loại sản phẩm / vùng cơ thể" value={rec.productTypeBodyParts} />
        <Field label="Điều kiện sử dụng và cảnh báo" value={rec.conditions} />
        <Field label="CAS" value={rec.casRaw} mono />
        <Link href={COSING_DETAIL_URL(rec.id)} target="_blank" rel="noreferrer" variant="caption">
          Xem mục này trên CosIng
        </Link>
      </Stack>
    </Paper>
  );
}

export default function DetailDrawer({
  record,
  onClose,
  percentage,
}: {
  record: CosingRecord | null;
  onClose: () => void;
  /** Concentration in the formula, if known, shown next to the limits. */
  percentage?: number;
}) {
  const [linked, setLinked] = useState<CosingRecord[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    setLinked(null);
    setError("");
    if (!record?.linkedIds.length) {
      setLinked([]);
      return;
    }
    const ctrl = new AbortController();
    fetchByIds(record.linkedIds, ctrl.signal)
      .then(setLinked)
      .catch((e) => {
        if (e?.name !== "AbortError") setError("Không tải được thông tin Annex liên quan.");
      });
    return () => ctrl.abort();
  }, [record]);

  const annexRecords = [
    ...(record && record.itemType === "substance" && record.annexRefs.length ? [record] : []),
    ...(linked ?? []).filter((r) => r.itemType === "substance" && r.annexRefs.length),
  ];
  const linkedIngredients = (linked ?? []).filter((r) => r.itemType === "ingredient");

  return (
    <Drawer
      anchor="right"
      open={!!record}
      onClose={onClose}
      PaperProps={{ sx: { width: { xs: "100%", sm: 520 }, borderRadius: 0 } }}
    >
      {record && (
        <Stack sx={{ height: "100%" }}>
          <Box sx={{ p: 3, pb: 2, bgcolor: "background.default" }}>
            <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
              <Chip
                size="small"
                label={record.itemType === "substance" ? "Substance" : "Ingredient"}
                variant="outlined"
              />
              <IconButton onClick={onClose} size="small" aria-label="Đóng">
                <CloseRounded />
              </IconButton>
            </Stack>
            <Typography variant="h5" sx={{ mt: 1, wordBreak: "break-word" }}>
              {record.inciName}
            </Typography>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 1.5 }} flexWrap="wrap" useFlexGap>
              <StatusChip verdict={verdictFor([record])} />
              <AnnexChips refs={record.annexRefs} />
              {record.status && (
                <Typography variant="caption" color="text.secondary">
                  Trạng thái: {record.status}
                </Typography>
              )}
            </Stack>
          </Box>
          <Divider />

          <Box sx={{ p: 3, overflow: "auto", flex: 1 }}>
            <Stack spacing={3}>
              <Box display="grid" gridTemplateColumns="1fr 1fr" gap={2}>
                <Field label="CAS" value={record.casRaw} mono />
                <Field label="EC" value={record.ecRaw} mono />
                <Field label="Tên hoá học" value={record.chemicalName} />
                <Field label="INN / Ph. Eur." value={[record.innName, record.phEurName].filter(Boolean).join(" · ")} />
                {percentage !== undefined && (
                  <Field label="Nồng độ trong công thức" value={`${percentage}%`} />
                )}
              </Box>

              {record.functions.length > 0 && (
                <Box>
                  <Typography variant="overline" color="text.secondary">
                    Chức năng
                  </Typography>
                  <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap sx={{ mt: 0.5 }}>
                    {record.functions.map((f) => (
                      <Chip key={f} size="small" label={f.toLowerCase()} sx={{ textTransform: "capitalize" }} />
                    ))}
                  </Stack>
                </Box>
              )}

              {(record.annexRefs.length > 0 || annexRecords.length > 0) && (
                <Box>
                  <Typography variant="overline" color="text.secondary">
                    Quy định theo Annex (EC 1223/2009)
                  </Typography>
                  <Stack spacing={1.5} sx={{ mt: 1 }}>
                    {linked === null && record.linkedIds.length > 0 && (
                      <Skeleton variant="rounded" height={120} />
                    )}
                    {annexRecords.map((r) => (
                      <AnnexEntry key={r.id} rec={r} />
                    ))}
                    {linked !== null && !annexRecords.length && record.annexRefs.length > 0 && (
                      <Alert severity="info">
                        CosIng ghi {record.annexRefs.map((a) => `${a.annex}/${a.ref}`).join(", ")} nhưng
                        không có bản ghi chi tiết đi kèm. Xem trên CosIng để biết điều kiện.
                      </Alert>
                    )}
                    {percentage !== undefined && annexRecords.some((r) => r.maximumConcentration) && (
                      <Alert severity="warning" variant="outlined">
                        Công thức dùng <b>{percentage}%</b>. Hãy đối chiếu với nồng độ tối đa và loại sản
                        phẩm ở trên.
                      </Alert>
                    )}
                  </Stack>
                </Box>
              )}

              {error && <Alert severity="error">{error}</Alert>}

              {record.otherRestrictions.length > 0 && (
                <Box>
                  <Typography variant="overline" color="text.secondary">
                    Hạn chế khác
                  </Typography>
                  <Stack component="ul" sx={{ m: 0, pl: 2.5, mt: 0.5 }} spacing={0.5}>
                    {record.otherRestrictions.map((r) => (
                      <Typography component="li" variant="body2" key={r}>
                        {r}
                      </Typography>
                    ))}
                  </Stack>
                </Box>
              )}

              {linkedIngredients.length > 0 && (
                <Box>
                  <Typography variant="overline" color="text.secondary">
                    INCI thuộc nhóm này
                  </Typography>
                  <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap sx={{ mt: 0.5 }}>
                    {linkedIngredients.map((r) => (
                      <Chip key={r.id} size="small" variant="outlined" label={r.inciName} />
                    ))}
                  </Stack>
                </Box>
              )}

              {record.sccsOpinions.length > 0 && (
                <Box>
                  <Typography variant="overline" color="text.secondary">
                    Ý kiến SCCS
                  </Typography>
                  <Stack spacing={0.75} sx={{ mt: 0.5 }}>
                    {record.sccsOpinions.map((o) => (
                      <Link
                        key={o.url}
                        href={o.url}
                        target="_blank"
                        rel="noreferrer"
                        variant="body2"
                        sx={{ display: "flex", gap: 0.75, alignItems: "flex-start" }}
                      >
                        <DescriptionOutlined sx={{ fontSize: 18, mt: "1px" }} />
                        {o.title}
                      </Link>
                    ))}
                  </Stack>
                </Box>
              )}

              <Field label="Mô tả" value={record.description} />
            </Stack>
          </Box>

          <Divider />
          <Box sx={{ p: 2 }}>
            <Button
              fullWidth
              variant="outlined"
              endIcon={<OpenInNewRounded />}
              href={COSING_DETAIL_URL(record.id)}
              target="_blank"
              rel="noreferrer"
            >
              Mở trên CosIng
            </Button>
          </Box>
        </Stack>
      )}
    </Drawer>
  );
}
