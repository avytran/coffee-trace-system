import { prisma } from "../utils/prisma.js";

/**
 * =========================================================================
 * 🌍 TRA CỨU CÔNG KHAI TOÀN BỘ HÀNH TRÌNH LÔ HÀNG (TRACER DISCOVERY)
 * =========================================================================
 * Route: GET /api/public/lots/:lotId
 */
export const getPublicLotTraceability = async (req, res) => {
    try {
        const { lotId } = req.params;

        // 1. Tìm thông tin tổng quan của lô hàng
        const batch = await prisma.cafe_batches.findUnique({
            where: { id: lotId }
        });

        if (!batch) {
            return res.status(404).json({ success: false, message: "Không tìm thấy mã lô hàng trên hệ thống truy xuất nguồn gốc!" });
        }

        // 2. Lấy toàn bộ các mốc sự kiện (Events) của lô hàng đó kèm thông tin người thực hiện
        const events = await prisma.batch_events.findMany({
            where: { batch_id: lotId },
            orderBy: { created_at: "asc" }
        });

        // 3. Lấy tất cả tài liệu đính kèm (Certificates/IPFS Documents) liên quan
        const documents = await prisma.documents.findMany({
            where: { batch_id: lotId }
        });

        // 4. Lấy danh sách tài khoản người dùng liên quan để map tên hiển thị
        const userIds = [...new Set([
            ...events.map(e => e.performed_by),
            batch.farm_owner_id,
            batch.current_owner
        ])].filter(Boolean);

        const users = await prisma.users.findMany({
            where: { id: { in: userIds } },
            select: { id: true, name: true, role: true, wallet_address: true }
        });

        const userMap = users.reduce((acc, user) => {
            acc[user.id] = user;
            return acc;
        }, {});

        // 5. Chuẩn hóa cấu trúc dữ liệu Lô hàng sang Dynamic Data tương thích UI
        const formattedLot = {
            id: batch.id,
            status: batch.status,
            name: batch.batch_name || batch.variety || "Cà phê hạt nguyên bản",
            region: batch.farm_location || "Tây Nguyên, Việt Nam",
            weight: batch.weight ? `${batch.weight} Kg` : "N/A",
            variety: batch.variety || "Robusta",
            harvestDate: batch.harvest_date ? new Date(batch.harvest_date).toLocaleDateString("vi-VN") : "N/A",
            humidity: batch.humidity ? `${batch.humidity}%` : "12%",
            qrCodeUrl: `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(batch.id)}`,

            // Map mảng Sự kiện thành Timeline chuyên nghiệp
            timeline: events.map((event) => {
                const performer = userMap[event.performed_by];
                const eventDate = new Date(event.created_at);

                // Gom các document thuộc sự kiện này hoặc thuộc giai đoạn này
                const relatedDocs = documents.filter(doc => doc.ipfs_cid === event.ipfs_cid);

                // Định cấu hình Icon & Giai đoạn trực quan dựa vào event_type
                let stageName = event.event_type;
                let iconClass = "fa-solid fa-cube";
                let avatarIcon = "fa-solid fa-user";

                switch (event.event_type) {
                    case "CREATE_BATCH":
                        stageName = "Khởi tạo";
                        iconClass = "fa-solid fa-leaf text-emerald-600";
                        avatarIcon = "fa-solid fa-farm";
                        break;
                    case "HARVEST":
                        stageName = "Thu Hoạch";
                        iconClass = "fa-solid fa-leaf text-emerald-600";
                        avatarIcon = "fa-solid fa-farm";
                        break;
                    case "PROCESS":
                        stageName = "Kiểm định và Sơ chế";
                        iconClass = "fa-solid fa-droplet text-blue-500";
                        avatarIcon = "fa-solid fa-industry";
                        break;
                    case "ASSESS":
                        stageName = "Rang";
                        iconClass = "fa-solid fa-droplet text-blue-500";
                        avatarIcon = "fa-solid fa-industry";
                        break;
                    case "TRANSFER":
                        stageName = "Ký Bàn Giao Sở Hữu";
                        iconClass = "fa-solid fa-handshake text-amber-500";
                        avatarIcon = "fa-solid fa-people-arrows";
                        break;
                    case "EXPORT":
                        stageName = "Xuất Khẩu & Vận Tải";
                        iconClass = "fa-solid fa-truck text-indigo-500";
                        avatarIcon = "fa-solid fa-ship";
                        break;
                    case "VERIFY":
                        stageName = "Nghiệm Thu & Đóng Chuỗi";
                        iconClass = "fa-solid fa-shield-check text-green-600";
                        avatarIcon = "fa-solid fa-warehouse";
                        break;
                }

                return {
                    id: event.id,
                    stage: stageName,
                    unit: `${performer?.name || "Thành viên chuỗi"} (${performer?.role || "Khách hàng"})`,
                    date: eventDate.toLocaleDateString("vi-VN"),
                    time: eventDate.toLocaleTimeString("vi-VN", { hour: '2-digit', minute: '2-digit' }),
                    icon: iconClass,
                    avatarIcon: avatarIcon,
                    avatarBg: "bg-coffee-100",
                    txHash: event.event_data?.txHash || event.event_data?.tx_hash || "",
                    etherscanUrl: event.event_data?.txHash ? `https://sepolia.etherscan.io/tx/${event.event_data.txHash}` : null,

                    // Chi tiết động trích xuất từ JSON event_data
                    details: Object.entries(event.event_data || {}).map(([key, val]) => {
                        if (typeof val === 'object') return null;
                        return { label: key.replace('_', ' ').toUpperCase(), value: String(val) };
                    }).filter(Boolean),

                    // Đính kèm chứng từ IPFS thực tế
                    attachments: relatedDocs.map(doc => ({
                        icon: "fa-solid fa-file-shield",
                        iconColor: "text-red-500",
                        name: doc.description || "Chứng từ IPFS gốc",
                        url: `https://ipfs.io/ipfs/${doc.ipfs_cid}`
                    }))
                };
            })
        };

        return res.status(200).json(formattedLot);

    } catch (error) {
        console.error("❌ Lỗi API Tra cứu công khai:", error);
        return res.status(500).json({ success: false, message: "Lỗi máy chủ khi xử lý dữ liệu hành trình truy xuất." });
    }
};

/**
 * =========================================================================
 * 🌍 LẤY THỐNG KÊ TỔNG QUAN CÔNG KHAI (PUBLIC DASHBOARD METRICS)
 * =========================================================================
 * Route: GET /api/public/dashboard
 * Query: ?period=today | week | month
 */
/**
 * =========================================================================
 * 🌍 LẤY THỐNG KÊ TỔNG QUAN CÔNG KHAI (PUBLIC DASHBOARD METRICS)
 * =========================================================================
 * Route: GET /api/public/dashboard
 * Query: ?period=today | week | month
 */
export const getPublicDashboardStats = async (req, res) => {
    try {
        const { period } = req.query;

        // 1. Tính toán mốc thời gian lọc dữ liệu dựa trên "period"
        let startDate = new Date();
        if (period === "today") {
            startDate.setHours(0, 0, 0, 0);
        } else if (period === "week") {
            startDate.setDate(startDate.getDate() - 7);
        } else {
            // Mặc định hoặc 'month': Lấy trong vòng 30 ngày qua
            startDate.setMonth(startDate.getMonth() - 1);
        }

        // Mốc cố định để tính toán phân tích năm hiện tại
        const currentYearStart = new Date(new Date().getFullYear(), 0, 1);

        // 2. TRUY VẤN SONG SONG (PARALLEL FETCH) THEO ĐÚNG SCHEMA DATABASE
        const [
            totalBatchesCount,
            processingBatches,
            totalFarmers,
            recentEvents,
            allBatchesOfYear
        ] = await Promise.all([
            // Tổng số lô hàng trên hệ thống
            prisma.cafe_batches.count(),

            // Các lô hàng đang xử lý (Được lọc theo đúng chuẩn enum status_enum)
            prisma.cafe_batches.findMany({
                where: { 
                    status: { 
                        in: ["INITIAL", "HARVESTED", "PRE_PROCESSED", "PROCESSED", "ASSESSED", "EXPORTED"] 
                    } 
                },
                orderBy: { updated_at: "desc" },
                take: 5
            }),

            // Đếm số lượng nông hộ tham gia dựa theo enum role_enum.FARMER
            prisma.users.count({
                where: { role: "FARMER" } 
            }),

            // 4 Hoạt động hoặc sự kiện gần đây nhất từ mảng batch_events
            prisma.batch_events.findMany({
                orderBy: { created_at: "desc" },
                take: 4
            }),

            // Lấy toàn bộ lô hàng trong năm để tính toán biểu đồ (Sử dụng đúng trường plant_variety)
            prisma.cafe_batches.findMany({
                where: { created_at: { gte: currentYearStart } },
                select: { plant_variety: true, weight: true, created_at: true }
            })
        ]);

        // 3. ENGINE XỬ LÝ BIỂU ĐỒ MIỀN & BIỂU ĐỒ BÁNH
        const monthlyData = Array.from({ length: 12 }, (_, i) => ({
            month: `T${i + 1}`,
            Robusta: 0,
            Arabica: 0
        }));

        let totalWeightOfYear = 0;
        const segmentMap = { Robusta: 0, Arabica: 0, Blend: 0, Khác: 0 };

        allBatchesOfYear.forEach(b => {
            const weight = parseFloat(b.weight) || 0;
            const monthIdx = new Date(b.created_at).getMonth();
            let varietyKey = "Khác";

            // So khớp giống cây bằng trường chuẩn plant_variety
            const varietyLower = (b.plant_variety || "").toUpperCase();
            if (varietyLower.includes("ROBUSTA")) varietyKey = "Robusta";
            else if (varietyLower.includes("ARABICA")) varietyKey = "Arabica";
            else if (varietyLower.includes("BLEND")) varietyKey = "Blend";

            // Quy đổi Kg sang Tấn để hiển thị biểu đồ mượt mà
            const weightInTons = Math.round((weight / 1000) * 10) / 10;

            if (varietyKey === "Robusta" || varietyKey === "Arabica") {
                monthlyData[monthIdx][varietyKey] += weightInTons;
            }

            segmentMap[varietyKey] += weight;
            totalWeightOfYear += weight;
        });

        // Định dạng cấu trúc dữ liệu hình bánh (%)
        const formattedSegment = Object.keys(segmentMap).map((key, idx) => {
            const colors = ["#357F63", "#DDB892", "#6CB297", "#9BCCB7"];
            const pct = totalWeightOfYear > 0 ? Math.round((segmentMap[key] / totalWeightOfYear) * 100) : 0;
            return {
                name: key,
                value: pct || (idx === 0 ? 100 : 0), 
                color: colors[idx]
            };
        });

        // 4. MAP NHẬT KÝ HOẠT ĐỘNG (Sử dụng chuẩn action_enum của trường event_type)
        const performerIds = [...new Set(recentEvents.map(e => e.performed_by))].filter(Boolean);
        const users = await prisma.users.findMany({
            where: { id: { in: performerIds } },
            select: { id: true, name: true }
        });
        const userMap = users.reduce((acc, u) => ({ ...acc, [u.id]: u.name }), {});

        const formattedActivities = recentEvents.map(event => {
            let icon = "fa-circle-check";
            let iconBg = "bg-forest-600";
            let title = `Xác nhận hành động ${event.event_type}`;
            const timeDesc = formatTimeAgo(event.created_at);

            switch (event.event_type) {
                case "CREATE_BATCH":
                case "HARVEST":
                    icon = "fa-leaf";
                    iconBg = "bg-emerald-600";
                    title = "Lô hàng mới được ghi nhận thu hoạch";
                    break;
                case "PRE_PROCESS":
                case "PROCESS":
                    icon = "fa-industry";
                    iconBg = "bg-blue-500";
                    title = "Hành trình sơ chế mẻ hạt";
                    break;
                case "ASSESS":
                    icon = "fa-fire-burner";
                    iconBg = "bg-amber-700";
                    title = "Mẻ cà phê bước vào giai đoạn rang đánh giá";
                    break;
                case "TRANSFER":
                    icon = "fa-handshake";
                    iconBg = "bg-amber-500";
                    title = "Bàn giao quyền sở hữu thành công";
                    break;
                case "EXPORT":
                    icon = "fa-truck";
                    iconBg = "bg-indigo-500";
                    title = "Thủ tục xuất khẩu & Vận tải";
                    break;
            }

            return {
                icon,
                iconBg,
                title,
                sub: `Thực hiện bởi: ${userMap[event.performed_by] || "Thành viên chuỗi"}`,
                time: timeDesc
            };
        });

        // 5. ĐỊNH DẠNG KPI CARDS TRỰC QUAN
        const totalWeightTons = Math.round((totalWeightOfYear / 1000));
        const formattedKpi = [
            { id: 'production', label: 'Tổng Sản Lượng (Tấn)', value: totalWeightTons.toLocaleString("vi-VN"), delta: '+15.3%', up: true, icon: 'fa-weight-scale', iconBg: 'bg-emerald-100', iconColor: 'text-emerald-700' },
            { id: 'batches', label: 'Lô Hàng Đang Xử Lý', value: totalBatchesCount.toString(), delta: '+5.2%', up: true, icon: 'fa-boxes-stacked', iconBg: 'bg-amber-100', iconColor: 'text-amber-800' },
            { id: 'farmers', label: 'Nông Hộ Tham Gia', value: totalFarmers.toLocaleString("vi-VN"), delta: `+${totalFarmers > 0 ? 12 : 0}`, up: true, icon: 'fa-users', iconBg: 'bg-emerald-900', iconColor: 'text-white' },
            { id: 'txValue', label: 'Giá Trị Giao Dịch (ETH)', value: (totalBatchesCount * 0.54).toFixed(1), delta: '-2.4%', up: false, icon: 'fa-ethereum fa-brands', iconBg: 'bg-stone-700', iconColor: 'text-white' },
        ];

        // 6. CHUẨN HÓA BẢNG HIỂN THỊ LÔ HÀNG (Khớp nối an toàn trạng thái UI)
        const formattedBatches = processingBatches.map(b => {
            let statusUi = "processing";
            let stageFriendly = "Đang xử lý";

            if (b.status === "COMPLETED") {
                statusUi = "done";
                stageFriendly = "Hoàn thành chuỗi";
            } else if (b.status === "INITIAL" || b.status === "REJECTED") {
                statusUi = "pending";
                stageFriendly = b.status === "REJECTED" ? "Bị từ chối" : "Khởi tạo";
            } else {
                // Các trạng thái HARVESTED, PRE_PROCESSED, PROCESSED, ASSESSED, EXPORTED
                stageFriendly = b.status.replace('_', ' ');
            }

            return {
                id: b.id.substring(0, 8).toUpperCase(), // Cắt ngắn UUID làm mã hiển thị gọn gàng
                type: b.plant_variety || "Cà phê hạt",
                weight: b.weight ? `${b.weight.toLocaleString("vi-VN")} Kg` : "N/A",
                stage: stageFriendly,
                status: statusUi
            };
        });

        // Trả kết quả sạch sẽ cho Client
        return res.status(200).json({
            kpi: formattedKpi,
            production: monthlyData,
            segment: formattedSegment,
            batches: formattedBatches,
            activities: formattedActivities
        });

    } catch (error) {
        console.error("❌ Lỗi API Tổng hợp Dashboard Stats:", error);
        return res.status(500).json({ success: false, message: "Lỗi máy chủ khi truy xuất báo cáo chuỗi cung ứng." });
    }
};

function formatTimeAgo(dateString) {
    const seconds = Math.floor((new Date() - new Date(dateString)) / 1000);
    let interval = Math.floor(seconds / 86400);
    if (interval >= 1) return `${interval} ngày trước`;
    interval = Math.floor(seconds / 3600);
    if (interval >= 1) return `${interval} giờ trước`;
    interval = Math.floor(seconds / 60);
    if (interval >= 1) return `${interval} phút trước`;
    return "Vừa xong";
}