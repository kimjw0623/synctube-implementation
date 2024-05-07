
export default (sequelize, DataTypes) => {
    const Room = sequelize.define("room", {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
        },
        title: {
            type: DataTypes.STRING
        },
        player_current_time: {
            type: DataTypes.INTEGER
        },
        player_current_state: {
            type: DataTypes.INTEGER
        },
        video_id: {
            type: DataTypes.STRING,
            references: {
                model: 'videos', // 참조하는 모델
                key: 'id'   // 참조하는 모델의 열
            }
        }
    });

    return Room;
};

