
export default (sequelize, DataTypes) => {
    const Playlist = sequelize.define("playlist", {
        user_id: {
            type: DataTypes.INTEGER,
            references: {
                model: 'users',
                key: 'id'
            }
        },
        room_id: {
            type: DataTypes.INTEGER,
            references: {
                model: 'rooms',
                key: 'id'
            }
        },
        video_id: {
            type: DataTypes.STRING,
            references: {
                model: 'videos',
                key: 'id'
            }
        },
        video_order: {
            type: DataTypes.INTEGER
        }
    });

    return Playlist;
};
